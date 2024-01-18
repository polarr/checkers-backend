const { CheckersServer } = require('./checkers');

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
    io;
    
    /**
     * Constructor initializes the properties
     * @param code The room code
     * @param socket1 The User ID of the first player
     * @param socket2 The User ID of the second player
     * @param time The time control for both players, in minutes
     */
    constructor(io, code, socket1, socket2, time){
        this.io = io;
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
        this.io.to(this.code).emit('update-game', {
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
        this.io.to(this.code).emit('game-over', {
            winner: whiteWin ? this.whitePlayer:this.redPlayer
        });

        // Disconnect the sockets from the room
        this.io.in(this.code).socketsLeave(this.code);
    }
}

module.exports = {
    GameServer
};