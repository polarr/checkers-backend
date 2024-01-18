const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { GameServer } = require("./game.js");

// emulate a websocket server for the testing
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173"
    }
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const gameTest = new GameServer(io, "abcd", "firstID", "secondID", 1);

test('sides assigned successfully', ()=> {
    expect(gameTest.getColor("firstID")).not.toBe(0);
});

test('timer clears successfully', ()=> {
    expect(gameTest.gameEndPromises.length).toBe(1);
    gameTest.clearTimeoutPromises();
    expect(gameTest.gameEndPromises.length).toBe(0);
});

test('red moves successfully', ()=> {
    // get ID of red side
    let redID = "firstID";
    if (gameTest.getColor("firstID") == 1){
        redID = "secondID";
    }
    // attempt to move red side
    gameTest.moveRed(redID, [0, 5], [1, 4]);
    // verify that is it now white's turn (moved successfully)
    expect(gameTest.turn).toBe(0);
});

test('game ends after specified time (1 minute)', async ()=> {
    // wait a minute
    await delay(60000);
    // check that white has ran out of time and game is ended
    expect(gameTest.ended).toBe(true);
}, 65000);