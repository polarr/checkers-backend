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

class GameServer {
    code;
    whitePlayer;
    redPlayer;
    moves;
    turn; // 0 = white, 1 = red
    turnTimestamp;
    whiteTime;
    redTime;
    checkers;
    gameEndPromises;
    ended;
    
    constructor(code, socket1, socket2, time){
        time = Math.min(time, 59);
        this.code = code;

        // randomize side
        if (Math.random() > 0.5){
            this.whitePlayer = socket1;
            this.redPlayer = socket2;
        } else {
            this.redPlayer = socket1;
            this.whitePlayer = socket2;
        }

        this.whiteTime = time * 60000; // minutes to ms
        this.redTime = time * 60000;
        this.moves = [];
        this.turn = 1;
        this.checkers = new CheckersServer();
        this.turnTimestamp = Date.now();
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
     * @param id socket id of the player
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

    moveWhite(id, from, to){
        // not white's turn or wrong auth
        if (this.turn == 1 || id != this.whitePlayer || this.ended){
            return;
        }

        if (this.checkers.move(true, from, to)){
            this.clearTimeoutPromises();
            this.whiteTime -= (Date.now() - this.turnTimestamp);
            this.turnTimestamp = Date.now();
            this.turn = 1;
            this.gameEndPromises.push(setTimeout(()=> {
                this.gameEnd(true, 1);
            }, this.redTime));
        }

        this.emitState();

        if (this.checkers.findWinner()){
            this.gameEnd(this.checkers.findWinner() == 1, 0);
        }
    }

    moveRed(id, from, to){
        // not red's turn or wrong auth
        if (this.turn == 0 || id != this.redPlayer || this.ended){
            return;
        }

        if (this.checkers.move(false, from, to)){
            this.clearTimeoutPromises();
            this.redTime -= (Date.now() - this.turnTimestamp);
            this.turnTimestamp = Date.now();
            this.turn = 0;
            this.gameEndPromises.push(setTimeout(()=> {
                this.gameEnd(false, 1);
            }, this.whiteTime));
        }

        this.emitState();
        if (this.checkers.findWinner()){
            this.gameEnd(this.checkers.findWinner() == 1, 0);
        }
    }

    clearTimeoutPromises(){
        for (let timeout of this.gameEndPromises){
            clearTimeout(timeout);
        }
        this.gameEndPromises = [];
    }

    gameEnd(whiteWin, reason){
        if (this.ended){
            return;
        }
        this.clearTimeoutPromises();
        this.ended = true;
        if (reason == 0){
            console.log((whiteWin ? "WHITE":"RED") + " player took all the pieces");
        } else if (reason == 1){
            console.log((whiteWin ? "RED":"WHITE") + " player ran out of time");
        } else {
            console.log((whiteWin ? "RED":"WHITE") + " player disconnected");
        }
        console.log('Ended Game: ' + this.code);
        io.to(this.code).emit('game-over', {
            winner: whiteWin ? this.whitePlayer:this.redPlayer
        });

        io.in(this.code).socketsLeave(this.code);
    }
}

function generateCode(){
    return uuidv4();
}

io.on("connection", (socket) => {
    socket.on("create-room", async ({time})=> {
        if (!(Number.isInteger(time) && time > 0)){
            return;
        }
        let code = generateCode();
        queue[code] = {
            socket1: socket.id,
            joinable: true,
            time
        };

        await socket.join(code);
        socket.emit('created-room', {code});
    });

    socket.on("join-room", async ({code}) => {
        if (!queue.hasOwnProperty(code)){
            socket.emit("join-room-failure", {
                error: "Room Code Invalid"
            });
            return;
        }

        let {socket1, joinable, time} = queue[code];

        if (!joinable){
            socket.emit("join-room-failure", {
                error: "Room Full"
            });
            return;
        }

        queue[code].joinable = false;
        rooms[code] = new GameServer(code, socket1, socket.id, time);
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

    socket.on("move", ({code, from, to})=> {
        if (!code || !rooms[code]){
            return;
        }
        let color = rooms[code].getColor(socket.id);
        if (!color){
            return;
        }

        if (color == 1){
            rooms[code].moveWhite(socket.id, from, to);
        } else if (color == 2){
            rooms[code].moveRed(socket.id, from, to);
        }
    });

    socket.on("disconnecting", ()=> {
        for (let room of socket.rooms){
            if (room == socket.id){
                continue;
            }

            let color = rooms[room].getColor(socket.id);
            rooms[room].gameEnd(color == 2, 2);
            socket.leave(room);
        }
    });
});

httpServer.listen(3000);