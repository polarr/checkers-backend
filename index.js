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
    board;

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
}

class GameServer {
    code;
    whitePlayer;
    redPlayer;
    moves;
    turn; // 0 = white, 1 = red
    time;
    board;
    
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

        this.time = time * 60; // minutes to seconds
        this.moves = [];
        this.turn = 1;
        this.board = new Board();
    }

    moveWhite(id, [from, to]){
        if (this.turn == 1 || this.id != this.whitePlayer){
            return;
        }
    }

    moveRed(){
        if (this.turn == 0 || this.id != this.redPlayer){
            return;
        }
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