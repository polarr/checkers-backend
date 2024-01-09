import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173"
    }
});

let queue = {}; // waiting queue after creating a game
let rooms = {}; // game rooms

class Board {
    board; // 1, 2 white 3, 4 red

    constructor(){
        this.board = [
            [0, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 0, 1, 0],
            [0, 1, 0, 1, 0, 1, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [3, 0, 3, 0, 3, 0, 3, 0],
            [0, 3, 0, 3, 0, 3, 0, 3],
            [3, 0, 3, 0, 3, 0, 3, 0]
        ];
    }

    isWhite([x, y]){
        return this.board[x][y] in [1, 2];
    }

    isRed([x, y]){
        return this.board[x][y] in [3, 4];
    }

    move([fromX, fromY], [toX, toY]){

    }
}

class GameServer {
    code;
    whitePlayer;
    redPlayer;
    moves;
    turn; // 0 = white, 1 = red
    turnTimestamp;
    whiteTime;
    redTime;
    board;
    gameEndPromises;
    
    constructor(code, socket1, socket2, time){
        this.code = code;

        // randomize side
        if (Math.random() > 0.5){
            whitePlayer = socket1;
            redPlayer = socket2;
        } else {
            redPlayer = socket1;
            whitePlayer = socket2;
        }

        this.whiteTime = time * 60000; // minutes to ms
        this.redTime = time * 60000;
        this.moves = [];
        this.turn = 1;
        this.board = new Board();
        this.turnTimestamp = Date.now();
        this.gameEndPromises.push(setTimeout(()=> {
            this.gameEnd(true);
        }, this.redTime));
    }

    moveWhite(id, [from, to]){
        if (this.turn == 1 || id != this.whitePlayer){
            return;
        }

        if (this.board.isWhite(from)){
            if (this.board.move(from, to)){
                this.clearTimeoutPromises();
                this.whiteTime -= (Date.now() - this.turnTimestamp);
                this.turnTime = Date.now();
                this.turn = 1;
                this.gameEndPromises.push(setTimeout(()=> {
                    this.gameEnd(true);
                }, this.redTime));
            }
        }
    }

    moveRed(id, [from, to]){
        if (this.turn == 0 || id != this.redPlayer){
            return;
        }

        if (this.board.isRed(from)){
            if (this.board.move(from, to)){
                this.clearTimeoutPromises();
                this.redTime -= (Date.now() - this.turnTimestamp);
                this.turnTime = Date.now();
                this.turn = 0;
                this.gameEndPromises.push(setTimeout(()=> {
                    this.gameEnd(false);
                }, this.whiteTime));
            }
        }
    }

    clearTimeoutPromises(){
        for (timeout in this.gameEndPromises){
            clearTimeout(timeout);
        }
    }

    gameEnd(redLost){
        
    }
}

io.on("connection", (socket) => {
    socket.on("create-room", ({time})=> {
        let code = generateCode();
        queue[code] = {
            socket1: socket.id,
            joinable: true,
            time
        };

        socket.join(code);
        socket.emit('created-room', {code});
    });

    socket.on("join-room", ({code}) => {
        if (!(code in queue)){
            socket.emit("join-room-failure", {
                error: "Room Code Invalid"
            });
        }

        let {socket1, joinable, time} = queue[code];

        if (!joinable){
            socket.emit("join-room-failure", {
                error: "Room Full"
            });
        }

        queue[code].joinable = false;
        rooms[code] = new GameServer(code, socket1, socket.id, time);
        socket.join(code);
        socket.to(rooms[code].whitePlayer).emit("start-game", {
            code,
            time: rooms[code].time,
            playWhite: true
        });
        socket.to(rooms[code].redPlayer).emit("start-game", {
            code,
            time: rooms[code].time,
            playWhite: false
        });
    });

    socket.on("move", ({from, to})=> {
        
    });
});

httpServer.listen(3000);