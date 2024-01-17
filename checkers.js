class Checkers {
    board;
    constructor(board){
        this.board = board ?? [
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

    /**
     * Transforms the coordinate into its 180 degree rotation
     * @param coordinate Given coordinate
     * @returns Transformed coordinate if the board was rotated 180 degrees
     */
    rotateCoord([x, y]){
        return [7 - x, 7 - y];
    }

    getBoard(){
        return this.board;
    }

    /**
     * Rotate the given board 180 degrees
     * @param originalBoard (optional) this.board by default, or given board
     * @returns Rotated deep cloned 2d array of originalBoard
    */
    rotateBoard(originalArray = this.board){
        // Get the number of rows and columns in the original array
        const rows = originalArray.length;
        const cols = originalArray[0].length;

        // Create a new array with the same dimensions
        const rotatedArray = new Array(rows);

        for (let i = 0; i < rows; i++) {
            rotatedArray[i] = new Array(cols);
        }

        // Populate the rotated array by reversing rows and columns
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                rotatedArray[i][j] = originalArray[rows - 1 - i][cols - 1 - j];
            }
        }

        return rotatedArray;
    }

    /**
     * Check if the given coordinate is valid and contains a Piece of the given color
     * @param isWhite Is the color white?
     * @param coordinate Given coordinate
     * @returns true if coordinate is valid and contains a piece of given color, false otherwise
     */
    validPiece(isWhite, [x, y]){
        if (x < 0 || x > 7 || y < 0 || y > 7){
            return false;
        }

        let piece = this.board[y][x];
        if (isWhite){
            return piece == 1 || piece == 2;
        }

        return piece == 3 || piece == 4;
    }

    /**
     * Check if given coordinate contains nothing
     * @param coordinate Given coordinate
     * @returns true if coordinate is valid and contains empty space, otherwise false
     */
    isEmpty([x, y]){
        if (x < 0 || x > 7 || y < 0 || y > 7){
            return false;
        }

        return this.board[y][x] == 0;
    }

    /**
     * Check if the given coordinate contains a King Piece
     * @param coordinate Given coordinate
     * @returns true if it contains a King, false otherwise
     */
    isKing([x, y]){
        return this.board[y][x] == 2 || this.board[y][x] == 4;
    }

    /**
     * Checks if a given piece at a coordinate can take any pieces, and returns those taking coordinates
     * @param coordinate
     * @returns Potentially empty array of possible taking coordinates of a piece
    */
    pieceCanTake([x, y]){
        let takes = [];

        // check if valid piece
        if (this.isEmpty([x, y])){
            return takes;
        }

        let isWhite = (this.board[y][x] == 1 || this.board[y][x] == 2);

        // which direction is up? if white then +1 to row and if red then -1 to row
        let up = isWhite ? 1:-1;

        if (this.validPiece(!isWhite, [x - 1, y + up]) && this.isEmpty([x - 2, y + 2 * up])){
            // a diagonally adjacent opponent piece exists and can be taken
            takes.push([x - 2, y + 2 * up]);
        }
        if (this.validPiece(!isWhite, [x + 1, y + up]) && this.isEmpty([x + 2, y + 2 * up])){
            // a diagonally adjacent opponent piece exists and can be taken
            takes.push([x + 2, y + 2 * up]);
        }
        if (this.isKing([x, y])){
            // can move "down"
            if (this.validPiece(!isWhite, [x - 1, y - up]) && this.isEmpty([x - 2, y - 2 * up])){
                // a diagonally adjacent opponent piece exists and can be taken
                takes.push([x - 2, y - 2 * up]);
            }
            if (this.validPiece(!isWhite, [x + 1, y - up]) && this.isEmpty([x + 2, y - 2 * up])){
                // a diagonally adjacent opponent piece exists and can be taken
                takes.push([x + 2, y - 2 * up]);
            }
        }

        return takes;
    }

    /**
     * Checks if player can take any pieces
     * @returns true or false
    */
    canTake(isWhite){
        // loop throgh board
        // check if row - 1, col +- 1 exists and contains opponent piece
        // and if row - 2, col +- 2 exists and is 0
        // if true, then can take that piece return true
        for (let row = 0; row < this.board.length; row++) {
            for (let col = 0; col < this.board[0].length; col++) {
                if (this.validPiece(isWhite, [col, row])) {
                    // check if given piece can take
                    if (this.pieceCanTake([col, row]).length > 0){
                        return true;
                    }
                }
            }
        }

        // cannot take any piece
        return false
    }

    /**
     * Finds the possible coordinates a piece can move to
     * @param coordinate of given piece
     * @return array of all possible coordinates to move to
    */
    pieceCanMove([x, y]){
        let possMoves = [];

        // check if valid piece
        if (this.isEmpty([x, y])){
            return possMoves;
        }

        let isWhite = (this.board[y][x] == 1 || this.board[y][x] == 2);

        // which direction is up? if white then +1 to row and if red then -1 to row
        let up = isWhite ? 1:-1;

        // case 1a: move diagonally up, check if spot exists on board, add move to array
        if (this.isEmpty([x - 1, y + up])){
            possMoves.push([x - 1, y + up]);
        }
        if (this.isEmpty([x + 1, y + up])){
            possMoves.push([x + 1, y + up]);
        }

        // case 1b: piece is king so can move diagonally backward, check if space is on board, add move to array
        if (this.isKing([x, y])) {
            if (this.isEmpty([x - 1, y - up])){
                possMoves.push([x - 1, y - up]);
            }
            if (this.isEmpty([x + 1, y - up])){
                possMoves.push([x + 1, y - up]);
            }
        }

        return possMoves;
    }

    /**
     * Finds the overall possible moves for a player and piece
     * @param isWhite If the player is playing white or not
     * @param coordinates of piece
     * @return array of possible moves for a player and piece
     */
    piecePossMoves(isWhite, [x, y]){
        if (!this.validPiece(isWhite, [x, y])){
            return [];
        }

        // can take
        if (this.canTake(isWhite)){
            // must take
            return this.pieceCanTake([x, y]);
        }
        // cannot take, only move
        return this.pieceCanMove([x, y]);
    }
}

class CheckersServer extends Checkers {
    whitePieces;
    redPieces;

    constructor(board){
        super(board);
        this.whitePieces = 12;
        this.redPieces = 12;
    }

    /**
     * Move the piece selected to spot selected
     * 
     * If there is an option to eat, the player must eat, if more eating is possible it must make the move(s)
     * Turn ends if piece is turned into a king
     * @param isWhite color of player
     * @param coordinate1's selected coordinate
     * @param coordinate2's selected coordinate to move to
     * @return false if turn doesn't end, true if turn ends
     */ 
    move(isWhite, [x1, y1], [x2, y2]) {
        if (!this.validPiece(isWhite, [x1, y1]) || !this.isEmpty([x2, y2])){
            return false; // invalid coordinates
        }

        if (this.canTake(isWhite)){
            // can take, must take
            let moveList = this.pieceCanTake([x1, y1]);
            if (moveList.length && moveList.some((el)=> {
                return el[0] == x2 && el[1] == y2;
            })){
                // move piece to new square
                this.board[y2][x2] = this.board[y1][x1];
                this.board[y1][x1] = 0;
                // delete taken piece (middle of both pieces)
                this.board[(y1 + y2)/2][(x1 + x2)/2] = 0;

                if (this.isWhite){
                    this.redPieces--;
                } else {
                    this.whitePieces--;
                }

                if (this.makeKing([x2, y2])){
                    // if promoted, end turn
                    return true;
                }

                // can the player keep on taking?
                return !this.canTake(isWhite);
            }

            return false;
        }

        // cannot take, only move
        let moveList = this.pieceCanMove([x1, y1]);
        if (moveList.length && moveList.some((el)=> {
            return el[0] == x2 && el[1] == y2;
        })){
            // move piece to new square
            this.board[y2][x2] = this.board[y1][x1];
            this.board[y1][x1] = 0;
            this.makeKing([x2, y2]);
            return true;
        }

        return false;
    }
    
    /**
     * Changes regular piece to king piece
     * @param player's piece to switch
     * @return if the piece promoted successfully or not
     */ 
    makeKing([x, y]) {
        let isWhite = (this.board[y][x] == 1 || this.board[y][x] == 2);

        let promotion = isWhite ? 7:0;

        if ((this.board[y][x] == 1 || this.board[y][x] == 3) && y == promotion) {
            this.board[y][x] += 1;
            return true;
        }

        return false;
    }
    
    /**
     * Checks if someone has won the game
     * @returns 0 if no winner, 1 if white wins, 2 if red wins
     */ 
    findWinner() {
        if (this.whitePieces == 0){
            return 2;
        }

        if (this.redPieces == 0){
            return 1;
        }

        return 0;
    }
}

export default { Checkers, CheckersServer };