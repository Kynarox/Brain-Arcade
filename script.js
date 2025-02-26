const GEMINI_API_KEY = 'AIzaSyCTKotD1v7p8UqgFQjwc_YiF3KOlKnCVwM'; // Replace with your key

class Checkers {
    constructor() {
        this.board = Array(8).fill().map(() => Array(8).fill(null));
        this.selectedPiece = null;
        this.currentPlayer = 'red';
        this.validMoves = [];
        this.setupPieces();
    }

    setupPieces() {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    if (row < 3) this.board[row][col] = { color: 'black', king: false };
                    if (row > 4) this.board[row][col] = { color: 'red', king: false };
                }
            }
        }
    }
checkDraw() {
        let currentPlayerHasMoves = false;
        const currentColor = this.currentPlayer;

        // Check each piece for the current player
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === currentColor) {
                    const moves = this.getValidMoves(row, col);
                    if (moves.length > 0) {
                        currentPlayerHasMoves = true;
                        break;
                    }
                }
            }
            if (currentPlayerHasMoves) break;
        }

        // If current player has no moves but still has pieces, it's a draw
        if (!currentPlayerHasMoves) {
            // Check if player still has pieces
            let haspieces = false;
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    if (this.board[row][col]?.color === currentColor) {
                        haspieces = true;
                        break;
                    }
                }
                if (haspieces) break;
            }
            return haspieces; // Only draw if player has pieces but no moves
        }
        return false;
    }



    getValidMoves(row, col) {
        const moves = [];
        const piece = this.board[row][col];
        if (!piece) return moves;

        const directions = piece.king ? [-1, 1] : piece.color === 'red' ? [-1] : [1];
        
        directions.forEach(direction => {
            [-1, 1].forEach(side => {
                const newRow = row + direction;
                const newCol = col + side;
                if (this.isValidPosition(newRow, newCol) && !this.board[newRow][newCol]) {
                    moves.push({ row: newRow, col: newCol, jump: false });
                }

                const jumpRow = row + (direction * 2);
                const jumpCol = col + (side * 2);
                const midRow = row + direction;
                const midCol = col + side;
                if (this.isValidPosition(jumpRow, jumpCol) && 
                    !this.board[jumpRow][jumpCol] &&
                    this.board[midRow][midCol] &&
                    this.board[midRow][midCol].color !== piece.color) {
                    moves.push({ row: jumpRow, col: jumpCol, jump: true });
                }
            });
        });
        return moves;
    }

    isValidPosition(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    movePiece(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        if ((piece.color === 'red' && toRow === 0) || (piece.color === 'black' && toRow === 7)) {
            piece.king = true;
        }

        if (Math.abs(toRow - fromRow) === 2) {
            this.board[(fromRow + toRow)/2][(fromCol + toCol)/2] = null;
        }

        this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
    }

    checkWinner() {
        const counts = { red: 0, black: 0 };
        this.board.forEach(row => row.forEach(piece => {
            if (piece) counts[piece.color]++;
        }));
        return counts.red === 0 ? 'black' : counts.black === 0 ? 'red' : null;
    }
}

class ChatAssistant {
    constructor(gameController) {
        this.game = gameController.game;
        this.controller = gameController;
        this.initChat();
        this.isChatOpen = true;
        
        // Bind methods to preserve 'this' context
        this.handleUserInput = this.handleUserInput.bind(this);
        this.processQuery = this.processQuery.bind(this);
        this.addMessage = this.addMessage.bind(this);
    }

    initChat() {
        this.chatMessages = document.getElementById('chatMessages');
        const sendButton = document.getElementById('sendMessage');
        const userInput = document.getElementById('userInput');

        // Use arrow functions to preserve 'this' context
        sendButton.addEventListener('click', () => this.handleUserInput());
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleUserInput();
        });
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        messageDiv.textContent = text;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async handleUserInput() {
        const input = document.getElementById('userInput');
        const message = input.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        await this.processQuery(message);
        input.value = '';
    }
    getAllPlayerMoves() {
        const moves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.game.board[row][col]?.color === 'red') {
                    this.game.getValidMoves(row, col).forEach(move => {
                        moves.push({
                            from: { row, col },
                            to: { row: move.row, col: move.col }
                        });
                    });
                }
            }
        }
        return moves;
    }

    
    async getGeminiResponse(query, validMoves) {
        try {
            const boardState = this.game.board.map(row => 
                row.map(piece => piece ? `${piece.color}${piece.king ? '-king' : ''}` : null)
            );

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `As expert checkers coach, suggest best red move. Current board:
${JSON.stringify(boardState)}
Valid moves: ${JSON.stringify(validMoves)}
Player query: "${query}"
Respond with JSON: {"explanation": "2-sentence strategy", "move": {"from": {"row":X,"col":Y}, "to": {"row":X,"col":Y}}}`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            
            // Better error handling for API response
            if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Invalid API response structure');
            }

            const text = data.candidates[0].content.parts[0].text;
            const jsonMatch = text.match(/\{.*\}/s);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch (error) {
            console.error('Gemini API Error:', error);
            return null;
        }
    }

    async analyzeBestPlayerMove() {
        const validMoves = this.getAllPlayerMoves();
        if (validMoves.length === 0) return null;

        // Score and return best move
        const scoredMoves = validMoves.map(move => ({
            ...move,
            score: this.scorePlayerMove(move.from.row, move.from.col, move.to)
        }));

        return scoredMoves.reduce((best, current) => 
            current.score > best.score ? current : best
        , scoredMoves[0]);
    }
    scorePlayerMove(fromRow, fromCol, move) {
        let score = 0;
        const piece = this.game.board[fromRow][fromCol];
        
        // Capture priority
        if (Math.abs(move.row - fromRow) === 2) score += 15;
        
        // King progression
        if (!piece.king && move.row === 0) score += 20;
        
        // Center control
        score += 4 - Math.abs(3.5 - move.col);
        
        // Defensive positioning
        if (fromRow < 4 && move.row > fromRow) score += 5;
        
        return score;
    }

    async processQuery(message) {
        try {
            if (message.toLowerCase().includes('help') || message.toLowerCase().includes('move')) {
                const validMoves = this.getAllPlayerMoves();
                this.addMessage("Analyzing position...", 'bot');
                
                if (validMoves.length === 0) {
                    this.addMessage("No valid moves available.", 'bot');
                    return;
                }

                try {
                    const geminiResponse = await this.getGeminiResponse(message, validMoves);
                    if (geminiResponse?.move) {
                        this.showGeminiSuggestion(geminiResponse.move, geminiResponse.explanation);
                        return;
                    }
                } catch (error) {
                    console.error('Gemini API Error:', error);
                }

                // Fallback to strategic analysis
                this.addMessage("Using strategic analysis...", 'bot');
                const bestMove = await this.analyzeBestPlayerMove();
                if (bestMove) {
                    this.showMoveSuggestion(bestMove);
                }
            }
        } catch (error) {
            console.error('Chat Error:', error);
            this.addMessage("⚠️ Analysis failed - please try again", 'bot');
        }
    }

    showGeminiSuggestion(move, explanation) {
        const moveDesc = `Suggested move: (${fromColToLetter(move.from.col)}${8 - move.from.row}) → (${fromColToLetter(move.to.col)}${8 - move.to.row})`;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message bot-message move-suggestion';
        messageDiv.innerHTML = `
            <div class="ai-explanation">${explanation}</div>
            <div class="move-display">${moveDesc}</div>
            <div class="hint">Click to highlight this move</div>
        `;
        
        messageDiv.addEventListener('click', () => {
            this.controller.game.selectedPiece = move.from;
            this.controller.game.validMoves = [move.to];
            this.controller.highlightMoves();
        });

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }


    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        document.querySelector('.chat-container').style.width = this.isChatOpen ? '320px' : '40px';
        document.getElementById('toggleChat').textContent = this.isChatOpen ? '▲' : '▼';
    }
}

class GameController {
    constructor() {
        this.game = new Checkers();
        this.difficulty = 'medium';
        this.initDOM();
        this.setupDifficultySelector();
        this.addEventListeners();
        this.updateStatus();
        this.chatAssistant = new ChatAssistant(this);
    }
    // Add to GameController class
    showGameEndAnimation(result) {
        const overlay = document.createElement('div');
        overlay.className = `game-end-overlay ${result}`;
        
        const content = document.createElement('div');
        content.className = 'game-end-content';
        
        switch(result) {
            case 'red':
                content.innerHTML = `
                    <div class="result-animation win">
                        <h2 class="result-title">VICTORY!</h2>
                        <div class="trophy-container">
                            <div class="trophy">🏆</div>
                            <div class="sparkles">✨</div>
                        </div>
                        <div class="confetti-container"></div>
                    </div>
                `;
                break;
            case 'black':
                content.innerHTML = `
                    <div class="result-animation lose">
                        <h2 class="result-title">DEFEATED!</h2>
                        <div class="defeat-icon">💔</div>
                        <p class="defeat-message">Better luck next time!</p>
                    </div>
                `;
                break;
            case 'draw':
                content.innerHTML = `
                    <div class="result-animation draw">
                        <h2 class="result-title">DRAW!</h2>
                        <div class="draw-icon">🤝</div>
                        <p class="draw-message">No valid moves available!</p>
                    </div>
                `;
                break;
        }
        
        content.innerHTML += `<button class="play-again">Play Again</button>`;
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        if (result === 'red') this.createConfetti();

        content.querySelector('.play-again').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.newGame();
        });
    }


createConfetti() {
    const confetti = document.querySelector('.confetti-container');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti';
        particle.style.setProperty('--delay', `${Math.random() * 5}s`);
        particle.style.setProperty('--rotation', `${Math.random() * 360}deg`);
        particle.style.left = `${Math.random() * 100}%`;
        confetti.appendChild(particle);
    }
}
    initDOM() {
        this.boardElement = document.getElementById('game-board');
        this.statusElement = document.getElementById('status');
        this.loadingElement = document.getElementById('loading');
        this.renderBoard();
    }

    renderBoard() {
        this.boardElement.innerHTML = '';
        this.game.board.forEach((row, rowIndex) => {
            row.forEach((piece, colIndex) => {
                const square = document.createElement('div');
                square.className = `square ${(rowIndex + colIndex) % 2 ? 'black' : 'white'}`;
                square.dataset.row = rowIndex;
                square.dataset.col = colIndex;

                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color}-piece${piece.king ? ' king' : ''}`;
                    square.appendChild(pieceElement);
                }

                square.addEventListener('click', (e) => this.handleSquareClick(e));
                this.boardElement.appendChild(square);
            });
        });
    }

    handleSquareClick(event) {
        if (this.game.currentPlayer !== 'red') return;

        const square = event.target.closest('.square');
        if (!square) return;

        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);

        if (this.game.selectedPiece) {
            this.handleMove(row, col);
        } else {
            this.handleSelection(row, col);
        }
    }

    handleSelection(row, col) {
        const piece = this.game.board[row][col];
        if (piece?.color === 'red') {
            this.game.selectedPiece = { row, col };
            this.game.validMoves = this.game.getValidMoves(row, col);
            this.highlightMoves();
        }
    }

    handleMove(row, col) {
        if (this.isValidMove(row, col)) {
            this.executeMove(row, col);
            this.checkGameStatus();
            if (this.game.currentPlayer === 'black') {
                this.makeAIMove();
            }
        }
        this.clearSelection();
    }

    async makeAIMove() {
        this.loadingElement.style.display = 'block';
        try {
            let aiMove;
            switch(this.difficulty) {
                case 'hard':
                    aiMove = await this.getGeminiAIMove();
                    break;
                case 'medium':
                    aiMove = this.getStrategicAIMove();
                    break;
                default:
                    aiMove = this.getRandomAIMove();
            }

            if (aiMove) {
                this.executeAIMove(aiMove);
            }
        } catch (error) {
            console.error('AI Error:', error);
            this.makeRandomAIMove();
        } finally {
            this.loadingElement.style.display = 'none';
        }
    }

    async getGeminiAIMove() {
        try {
            const boardState = this.game.board.map(row => 
                row.map(piece => piece ? `${piece.color}${piece.king ? '-king' : ''}` : null)
            );
            
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `As expert checkers AI, suggest best black move. Valid moves: ${JSON.stringify(this.getAllValidAIMoves())}. Board:
${JSON.stringify(boardState)}
Respond ONLY with JSON: {"from": {"row": X, "col": Y}, "to": {"row": X, "col": Y}}`
                        }]
                    }]
                })
            });

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            const jsonMatch = text.match(/\{.*\}/s);
            const move = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            return this.validateAIMove(move) ? move : this.getStrategicAIMove();
        } catch {
            return this.getStrategicAIMove();
        }
    }

    getStrategicAIMove() {
        const allMoves = this.getAllValidAIMoves();
        const jumps = allMoves.filter(move => 
            Math.abs(move.from.row - move.to.row) === 2
        );

        if (jumps.length > 0) return jumps[Math.floor(Math.random() * jumps.length)];

        const kingMoves = allMoves.filter(move => 
            this.game.board[move.from.row][move.from.col].king
        );

        if (kingMoves.length > 0) {
            return kingMoves.reduce((best, current) => 
                this.scoreMove(current) > this.scoreMove(best) ? current : best
            , kingMoves[0]);
        }

        return this.getRandomAIMove();
    }

    scoreMove(move) {
        const piece = this.game.board[move.from.row][move.from.col];
        let score = 0;
        
        // Progress towards kinging
        if (!piece.king) score += (7 - move.to.row) * 2;
        
        // Center control
        score += 3 - Math.abs(3.5 - move.to.col);
        
        // Capture priority
        if (Math.abs(move.to.row - move.from.row) === 2) score += 10;
        
        // Protect king
        if (piece.king) score += 5 - Math.abs(3.5 - move.to.row);
        
        return score;
    }

    getRandomAIMove() {
        const moves = this.getAllValidAIMoves();
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
    }

    getAllValidAIMoves() {
        const moves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.game.board[row][col]?.color === 'black') {
                    this.game.getValidMoves(row, col).forEach(move => {
                        moves.push({
                            from: { row, col },
                            to: { row: move.row, col: move.col }
                        });
                    });
                }
            }
        }
        return moves;
    }

    validateAIMove(move) {
        try {
            return this.game.getValidMoves(move.from.row, move.from.col)
                .some(m => m.row === move.to.row && m.col === move.to.col);
        } catch {
            return false;
        }
    }

    executeAIMove(aiMove) {
        this.game.movePiece(aiMove.from.row, aiMove.from.col, aiMove.to.row, aiMove.to.col);
        this.highlightAIMove(aiMove);
        this.renderBoard();
        this.updateStatus();
        this.checkGameStatus(); // This will now use the new animation system
        this.game.currentPlayer = 'red';
    }
    highlightAIMove(move) {
        // Create highlight elements
        const fromHighlight = document.createElement('div');
        const toHighlight = document.createElement('div');
        
        fromHighlight.className = 'ai-move-highlight from';
        toHighlight.className = 'ai-move-highlight to';
        
        // Position highlights
        const squares = document.querySelectorAll('.square');
        const fromSquare = squares[move.from.row * 8 + move.from.col];
        const toSquare = squares[move.to.row * 8 + move.to.col];
        
        fromSquare.appendChild(fromHighlight);
        toSquare.appendChild(toHighlight);
        
        // Remove highlights after animation
        setTimeout(() => {
            fromHighlight.remove();
            toHighlight.remove();
        }, 1000);
    }

    setupDifficultySelector() {
        const difficultySelect = document.getElementById('difficulty');
        difficultySelect.addEventListener('change', (e) => {
            this.difficulty = e.target.value;
            this.newGame();
        });
    }

    isValidMove(row, col) {
        return this.game.validMoves.some(m => m.row === row && m.col === col);
    }

    executeMove(row, col) {
        this.game.movePiece(this.game.selectedPiece.row, this.game.selectedPiece.col, row, col);
        this.renderBoard();
        this.updateStatus();
    }

    checkGameStatus() {
        const winner = this.game.checkWinner();
        if (winner) {
            this.showGameEndAnimation(winner);
            return;
        }

        if (this.game.checkDraw()) {
            this.showGameEndAnimation('draw');
            return;
        }
    }

    highlightMoves() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'valid-move');
        });

        if (this.game.selectedPiece) {
            const selectedSquare = document.querySelector(
                `[data-row="${this.game.selectedPiece.row}"][data-col="${this.game.selectedPiece.col}"]`
            );
            selectedSquare?.classList.add('selected');
        }

        this.game.validMoves.forEach(move => {
            document.querySelector(
                `[data-row="${move.row}"][data-col="${move.col}"]`
            )?.classList.add('valid-move');
        });
    }

    clearSelection() {
        this.game.selectedPiece = null;
        this.game.validMoves = [];
        this.highlightMoves();
    }

    newGame() {
        this.game = new Checkers();
        this.renderBoard();
        this.updateStatus();
    }

    updateStatus() {
        this.statusElement.textContent = `Current Player: ${this.game.currentPlayer.toUpperCase()} | Difficulty: ${this.difficulty.toUpperCase()}`;
    }

    addEventListeners() {
        document.getElementById('newGame').addEventListener('click', () => this.newGame());
    }
}

function fromColToLetter(col) {
    return String.fromCharCode(65 + col);
}

new GameController();