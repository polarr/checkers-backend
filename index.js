import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from 'uuid';
import { CheckersServer } from './checkers.js';
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL ?? "http://localhost:5173"
    }
});

let queue = {}; // waiting queue after creating a game
let rooms = {}; // game rooms

/**
 * Server class that implements the server state logic and handles websocket requests
 * @param code The room code
 * @param whitePlayer The User ID of the white player
 * @param redPlayer The User ID of the red player
 * @param turn A boolean indicating the turn (0 = white, 1 = red)
 * @param turnTimestamp A timestamp storing the last time a change in turn occurred
 * @param whiteTime A number storing the milliseconds left for player white
 * @param redTime A number storing the milliseconds left to player red
 * @param checkers A CheckersServer object storing the checkers game state
 * @param gameEndPromises An array storing setTimeout Node.js Promises to end the game
 * @param ended A boolean indicating if the game has ended or not
 */
class GameServer {
    code;
    whitePlayer;
    redPlayer;
    turn; // 0 = white, 1 = red
    turnTimestamp;
    whiteTime;
    redTime;
    checkers;
    gameEndPromises;
    ended;
    
    /**
     * Constructor initializes the properties
     * @param code The room code
     * @param socket1 The User ID of the first player
     * @param socket2 The User ID of the second player
     * @param time The time control for both players, in minutes
     */
    constructor(code, socket1, socket2, time){
        time = Math.min(time, 59);
        this.code = code;

        // randomize side and assign IDs
        if (Math.random() > 0.5){
            this.whitePlayer = socket1;
            this.redPlayer = socket2;
        } else {
            this.redPlayer = socket1;
            this.whitePlayer = socket2;
        }

        // Sets the time and initializes properties
        this.whiteTime = time * 60000; // minutes to ms
        this.redTime = time * 60000;
        this.turn = 1;
        this.checkers = new CheckersServer();
        this.turnTimestamp = Date.now();
        // Start the timer for red
        this.gameEndPromises = [setTimeout(()=> {
            this.gameEnd(true, 1);
        }, this.redTime)];
        this.ended = false;
    }

    /**
     * Emit the current game state to the players using websocket
     */
    emitState(){
        io.to(this.code).emit('update-game', {
            board: this.checkers.board,
            turn: this.turn
        });
    }

    /**
     * Check player color
     * @param id User ID of the player
     * @return 0 if invalid, 1 if white, 2 if red
     */
    getColor(id){
        if (id == this.redPlayer){
            return 2;
        }
        if (id == this.whitePlayer){
            return 1;
        }
        return 0;
    }

    /**
     * Attempts to move for white
     * @param id User ID of the request
     * @param from Coordinate to move from
     * @param to Coordinate to move to
     */
    moveWhite(id, from, to){
        // not white's turn or wrong ID authentication
        if (this.turn == 1 || id != this.whitePlayer || this.ended){
            return;
        }

        // moves the piece
        if (this.checkers.move(true, from, to)){
            // if moves successfully, changes the turn to red and start's red's timer
            this.clearTimeoutPromises();
            this.whiteTime -= (Date.now() - this.turnTimestamp);
            this.turnTimestamp = Date.now();
            this.turn = 1;
            this.gameEndPromises.push(setTimeout(()=> {
                this.gameEnd(true, 1);
            }, this.redTime));
        }

        // send the new board state (potentially unmodified) to the clients
        this.emitState();

        // check if game has actually ended, and if so, end the game
        if (this.checkers.findWinner()){
            this.gameEnd(this.checkers.findWinner() == 1, 0);
        }
    }

    /**
     * Attempts to move for red
     * @param id User ID of the request
     * @param from Coordinate to move from
     * @param to Coordinate to move to
     */
    moveRed(id, from, to){
        // not red's turn or wrong ID authentication
        if (this.turn == 0 || id != this.redPlayer || this.ended){
            return;
        }

        // moves the piece
        if (this.checkers.move(false, from, to)){
            // if moves successfully, changes the turn to white and start's white's timer
            this.clearTimeoutPromises();
            this.redTime -= (Date.now() - this.turnTimestamp);
            this.turnTimestamp = Date.now();
            this.turn = 0;
            this.gameEndPromises.push(setTimeout(()=> {
                this.gameEnd(false, 1);
            }, this.whiteTime));
        }

        // send the new board state (potentially unmodified) to the clients
        this.emitState();

        // check if game has actually ended, and if so, end the game
        if (this.checkers.findWinner()){
            this.gameEnd(this.checkers.findWinner() == 1, 0);
        }
    }

    /**
     * Stops all of the timers that if ended, 
     * would trigger a gameEnd call with a loss for the player the timer started for
     */
    clearTimeoutPromises(){
        for (let timeout of this.gameEndPromises){
            clearTimeout(timeout);
        }
        this.gameEndPromises = [];
    }

    /**
     * Ends the game
     * @param whiteWin A boolean storing if white was the player that won
     * @param reason A number storing the reason that the game ended
     */
    gameEnd(whiteWin, reason){
        // If already ended, method call is redudant
        if (this.ended){
            return;
        }

        // Stop all the timers and end the game
        this.clearTimeoutPromises();
        this.ended = true;

        // Log the reason the game ended: either a player took all the pieces,
        // or someone ran out of time or disconnected
        if (reason == 0){
            console.log((whiteWin ? "WHITE":"RED") + " player took all the pieces");
        } else if (reason == 1){
            console.log((whiteWin ? "RED":"WHITE") + " player ran out of time");
        } else {
            console.log((whiteWin ? "RED":"WHITE") + " player disconnected");
        }
        console.log('Ended Game: ' + this.code);

        // Emit to the clients that the game has ended and announce the winner
        io.to(this.code).emit('game-over', {
            winner: whiteWin ? this.whitePlayer:this.redPlayer
        });

        // Disconnect the sockets from the room
        io.in(this.code).socketsLeave(this.code);
    }
}

function generateCode(){
    return uuidv4();
}

/**
 * Websocket connection handling
 */
io.on("connection", (socket) => {
    /**
     * Requests a room creation
     * @param time Time control for the room
     */
    socket.on("create-room", async ({time})=> {
        // Validates the time is a valid positive integer
        if (!(Number.isInteger(time) && time > 0)){
            return;
        }

        // Generates a UUID room code and waits in the queue for a challenger
        let code = generateCode();
        queue[code] = {
            socket1: socket.id,
            joinable: true,
            time
        };

        // Make the websocket join the room and emit that a room is created to the client
        await socket.join(code);
        socket.emit('created-room', {code});
    });

    /**
     * Requests a room joining
     * @param code Code for the room
     */
    socket.on("join-room", async ({code}) => {
        // Validates that the room exists
        if (!queue.hasOwnProperty(code)){
            socket.emit("join-room-failure", {
                error: "Room Code Invalid"
            });
            return;
        }

        let {socket1, joinable, time} = queue[code];

        // Validates that the room is still joinable
        if (!joinable){
            socket.emit("join-room-failure", {
                error: "Room Full"
            });
            return;
        }

        // Start a GameServer in the room
        queue[code].joinable = false;
        rooms[code] = new GameServer(code, socket1, socket.id, time);

        // Make the websockets join the room and emit that the game has started
        await socket.join(code);
        io.to(code).emit('init-game');
        io.to(rooms[code].whitePlayer).emit("start-game", {
            code,
            time: rooms[code].whiteTime,
            playWhite: true
        });
        io.to(rooms[code].redPlayer).emit("start-game", {
            code,
            time: rooms[code].redTime,
            playWhite: false
        });

        console.log("Started Game: " + code);
    });

    /**
     * Requests a move in the game
     * @param code Room code of the request
     * @param from Coordinate to move from
     * @param to Coordinate to move to
     */
    socket.on("move", ({code, from, to})=> {
        // Check that room exists
        if (!code || !rooms[code]){
            return;
        }

        // Check which color the request is made from
        let color = rooms[code].getColor(socket.id);
        if (!color){
            return;
        }

        // Attempt to fulfill the move request in the room
        if (color == 1){
            rooms[code].moveWhite(socket.id, from, to);
        } else if (color == 2){
            rooms[code].moveRed(socket.id, from, to);
        }
    });

    /**
     * Handles a client disconnecting
     */
    socket.on("disconnecting", ()=> {
        for (let room of socket.rooms){
            if (room == socket.id){
                continue;
            }

            // For each room the websocket is in, end the game and make the opponent win
            let color = rooms[room].getColor(socket.id);
            rooms[room].gameEnd(color == 2, 2);
            socket.leave(room);
        }
    });
});

httpServer.listen(3000);