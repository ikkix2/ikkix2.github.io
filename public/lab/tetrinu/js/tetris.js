const ROW = 20;
const COL = 10;
const VACANT = "white";
const SCORES = [0, 40, 100, 300, 1200];
let dropStart = Date.now();
let gameOver = false;
let board = new Board();
let p = new Piece();
let display = new Display();
let camera = new Camera();
let sound = new Sound();
let rec = new Rec(); // 音声入力機能
let score = 0;
let hiscore = 0;
let hiscore_holder = "";
let level = 1;
let speed = 1000;
let firebaseConfig = {
    apiKey: "AIzaSyB3zPkIudOZDQbii68Cjuox4Q-fBYfb_hI",
    authDomain: "chats-b4a9a.firebaseapp.com",
    databaseURL: "https://chats-b4a9a.firebaseio.com",
    projectId: "chats-b4a9a",
    storageBucket: "chats-b4a9a.appspot.com",
    messagingSenderId: "733554642421",
    appId: "1:733554642421:web:5e935b6a9b6baca7"
};
firebase.initializeApp(firebaseConfig);

const newPostRef = firebase.database().ref();

newPostRef.setScore = function (name, num) {
    if (name == "") {
        name = "誰か";
    }

    this.push({
        username: name,
        hiscore: num
    });
}

newPostRef.on('child_added', function (data) {
    let v = data.val();
    let k = data.key;

    hiscore = v.hiscore;
    hiscore_holder = v.username;
    return;
});


function Board() {
    let board = new Array(ROW);

    for (let y = 0; y < ROW; y++) {
        board[y] = new Array(COL).fill(VACANT);
    }

    board.update = function () {
        //this[p.x] = "yellow";
    };

    board.getBlockMappedBoard = function () {
        let block = p.tetromino[p.tetrominoN];
        let bmBoard = JSON.parse(JSON.stringify(board));
        let counterY = 0;
        let counterX = 0;

        if (p.y > -1) {
            for (let i = 0; i < block.length; i++) {
                for (let j = 0; j < block[i].length; j++) {
                    if (block[i][j] === 1) {
                        bmBoard[i + p.y][j + p.x] = p.color;
                    }
                }
            }
        }

        return bmBoard;
    }

    board.eraseLine = function () {
        let isRowFull;
        let eraseLine = 0;

        for (let r = 0; r < ROW; r++) {
            isRowFull = true;

            for (let c = 0; c < COL; c++) {
                isRowFull = isRowFull && (this[r][c] != VACANT);
            }

            if (isRowFull) {
                // if the row is full we move down all the rows above it
                for (let y = r; y > 1; y--) {
                    for (c = 0; c < COL; c++) {
                        this[y][c] = this[y - 1][c];
                    }
                }
                // the top row board[0][..] has no row above it
                for (c = 0; c < COL; c++) {
                    this[0][c] = VACANT;
                }
                eraseLine++;
            }
        }

        return eraseLine;
    }

    return board;
}

function Piece() {
    const PIECES = [
        [Z, "red"],
        [S, "green"],
        [T, "yellow"],
        [O, "blue"],
        [L, "purple"],
        [I, "cyan"],
        [J, "orange"]
    ];

    this.type = Math.floor(Math.random() * PIECES.length);
    this.tetromino = PIECES[this.type][0];
    this.tetrominoN = 0;
    this.color = PIECES[this.type][1];
    this.x = 3;
    this.y = -2;
    this.activeTetromino = this.tetromino[this.tetrominoN];
    this.locked = false;

    this.moveDown = function () {
        if (!this.collision(0, 1, this.activeTetromino)) {
            this.y++;
        } else {
            this.lock();
        }
    }

    this.moveRight = function () {
        if (!this.collision(1, 0, this.activeTetromino)) {
            this.x++;
        }
    }

    this.moveLeft = function () {
        if (!this.collision(-1, 0, this.activeTetromino)) {
            this.x--;
        }
    }

    // rotate the piece
    this.rotate = function () {
        let nextPattern = this.tetromino[(this.tetrominoN + 1) % this.tetromino.length];
        let kick = 0;

        if (this.collision(0, 0, nextPattern)) {
            if (this.x > COL / 2) {
                // it's the right wall
                kick = -1; // we need to move the piece to the left
            } else {
                // it's the left wall
                kick = 1; // we need to move the piece to the right
            }
        }

        if (!this.collision(kick, 0, nextPattern)) {
            this.x += kick;
            this.tetrominoN = (this.tetrominoN + 1) % this.tetromino.length; // (0+1)%4 => 1
            this.activeTetromino = this.tetromino[this.tetrominoN];
        }
    }

    this.lock = function () {
        for (let r = 0; r < this.activeTetromino.length; r++) {
            for (let c = 0; c < this.activeTetromino.length; c++) {
                // we skip the vacant squares
                if (!this.activeTetromino[r][c]) {
                    continue;
                }

                // pieces to lock on top = game over
                if (this.y + r < 0) {
                    gameOver = true;
                    break;
                }

                board[this.y + r][this.x + c] = this.color;
            }
        }

        this.locked = true;
    }

    // collision fucntion
    this.collision = function (x, y, piece) {
        for (r = 0; r < piece.length; r++) {
            for (c = 0; c < piece.length; c++) {
                // if the square is empty, we skip it
                if (!piece[r][c]) {
                    continue;
                }
                // coordinates of the piece after movement
                let newX = this.x + c + x;
                let newY = this.y + r + y;

                // conditions
                if (newX < 0 || newX >= COL || newY >= ROW) {
                    return true;
                }
                // skip newY < 0; board[-1] will crush our game
                if (newY < 0) {
                    continue;
                }
                // check if there is a locked piece alrady in place
                if (board[newY][newX] != VACANT) {
                    return true;
                }
            }
        }
        return false;
    }
}

function Display() {
    let tmpBoard;
    let ablocks = new ABlocks();

    this.update = function () {
        tmpBoard = board.getBlockMappedBoard();
        // this.show2D();
        this.show3D();
        this.showScore();
        this.showLevel();
    }

    this.show2D = function () {
        let el = document.querySelector("#tetris");
        let tmpStr = "";
        let str = "";

        for (let i = 0; i < tmpBoard.length; i++) {
            for (let j = 0; j < tmpBoard[i].length; j++) {
                if (tmpBoard[i][j] !== VACANT) {
                    tmpStr = "■";
                } else {
                    tmpStr = "□";
                }

                str += tmpStr;
            }
            str += "</p>";
        }

        el.innerHTML = str;
    }

    this.show3D = function () {
        for (let i = 0; i < tmpBoard.length; i++) {
            for (let j = 0; j < tmpBoard[i].length; j++) {
                if (tmpBoard[i][j] !== VACANT) {
                    ablocks[i][j].setSrc('#' + tmpBoard[i][j] + 'Block');
                    ablocks[i][j].setVisible("true");
                } else {
                    ablocks[i][j].setVisible("false");
                }
            }
        }
    }

    this.showScore = function () {
        let el = document.querySelector("#score");
        el.innerHTML = "Score: " + score;

        let el2 = document.querySelector("#hiscore");
        el2.innerHTML = "Hi-Score: " + hiscore + " by " + hiscore_holder;
    }

    this.showLevel = function () {
        let el = document.querySelector("#level");
        el.innerHTML = "Level: " + level;
    }

    this.showRestart = function () {
        let el = document.querySelector("#restart");
        let el2 = document.querySelector("#description");
        let el4 = document.querySelector("#mainLight");
        let el5 = document.querySelector("#pointLight");
        let el6 = document.querySelector("#gameOverImage");
        let el7 = document.querySelector("#changeView");

        el.style.display = "block";
        el2.style.display = "none";
        el4.setAttribute('color', '#333333');
        el5.setAttribute('intensity', '0');
        el6.setAttribute('visible', 'true');
        el7.style.display = "none";
    }

    function ABlock() {
        let scene = document.querySelector('#playBox');
        let el = document.createElement('a-box');
        let x, y, w, h, d, pos;

        this.init = function (varY, varX) {
            x = varX;
            y = varY;
            w = "1.5";
            h = "1.5";
            d = "1.5";
            pos = (COL - (w * x)) + ' ' + (ROW - (h * y)) + ' ' + '0';
            el.setAttribute('width', w);
            el.setAttribute('height', h);
            el.setAttribute('depth', d);
            el.setAttribute('scale', '1 1 1');
            el.setAttribute('position', pos);
            el.setAttribute('visible', 'true');
            el.setAttribute('material', 'transparent:true');
            el.setAttribute('src', '#grayBlock');
            el.setAttribute('id', 'block' + varX + varY);
            scene.appendChild(el);
        }

        this.setVisible = function (visible) {
            el.setAttribute('visible', visible);
        }

        this.setSrc = function (src) {
            el.setAttribute('src', src);
        }
    }

    function ABlocks() {
        var ablocks = new Array();

        for (let i = 0; i < ROW + 2; i++) {
            ablocks[i] = new Array();
            for (let j = 0; j < COL + 2; j++) {
                ablocks[i][j] = new ABlock();
                ablocks[i][j].init(i, j);

                if (j > 3 && j < 8 && i == 0) {
                    ablocks[i][j].setVisible("false");
                }
            }
        }

        // remove outer blocks
        ablocks.shift();
        ablocks.pop();

        for (i = 0; i < ablocks.length; i++) {
            ablocks[i].shift();
            ablocks[i].pop();
        }

        return ablocks;
    }
}

function Sound(num) {
    let fnames = [
        "audios/sabre_dance.mp3",
        "audios/cursor2.wav",
        "audios/cursor.wav",
        "audios/se_noise_1.mp3",
        "audios/se_dosun_1.mp3",
        "audios/22_macho_down.wav",
        "audios/nc147299.wav",
        "audios/nc148325.mp3"
    ];

    let audios = [
        new Howl({ src: [fnames[0]], loop: true }),
        new Howl({ src: [fnames[1]] }),
        new Howl({ src: [fnames[2]] }),
        new Howl({ src: [fnames[3]] }),
        new Howl({ src: [fnames[4]] }),
        new Howl({ src: [fnames[5]] }),
        new Howl({ src: [fnames[6]] }),
        new Howl({ src: [fnames[7]] })
    ]

    this.playFlag = false;

    this.toggle = function () {
        this.playFlag = !this.playFlag;
    }

    this.stop = function (num) {
        audios[num].stop();
    }

    this.play = function (num) {
        if (this.playFlag) {
            audios[num].play();
        }
    }
}

function Camera() {
    let el = document.querySelector("#camera");
    let currentNum = 1;

    this.changePos = function (num) {
        if (num === 0) {
            currentNum = (currentNum === 3) ? 1 : currentNum + 1;
        } else {
            currentNum = num;
        }

        switch (currentNum) {
            case 1:
                el.setAttribute('rotation', "43 -180 0");
                el.setAttribute('position', "0 -1 0");
                break;
            case 2:
                el.setAttribute('rotation', "-50 -180 0");
                el.setAttribute('position', "0 42 -3");
                break;
            case 3:
                el.setAttribute('rotation', "0 -180 0");
                el.setAttribute('position', "0 10 -90");
                break;
        }
    }
}

function Rec() {
    if (typeof webkitSpeechRecognition === "undefined") {
        return false;
    }

    let recognition = new webkitSpeechRecognition();
    recognition.lang = 'ja-JP';
    // recognition.interimResults = true;
    // recognition.continuous = true;
    recognition.interimResults = false;
    recognition.continuous = false;

    let finalTranscript = '';
    let interimTranscript = '';
    let el = document.querySelector("#chatbox");
    let str = "";
    let hatenaCounter = 0;
    this.isFinal = true;

    this.start = function () {
        recognition.start();
    }

    recognition.onend = (event) => {
        recognition.start();
    }

    recognition.onresult = (event) => {
        let transcript = "";
        let min = 0;
        let max = 6;
        let rand = Math.floor(Math.random() * (max - min + 1) + min);
        let str = "";
        let comments = [
            "ほいきた！",
            "よっしゃ！",
            "まかしとき！",
            "やったるで！",
            "かなんわ！",
            "気合い入れるで！",
            "いくでぇ！"
        ];
        let comment = comments[rand];

        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript = transcript;
            }
        }

        if (transcript !== "") {
            if (transcript.indexOf("左") > -1) {
                hatenaCounter = 0;
                str += "<p class='blockComment'>" + "ブロック：「左か！" + comment + "」" + "</p>";
                str += "<p class='yourComment'>" + "あなた：「左！」" + "</p>";
                keyDownLeft();
            } else if (transcript.indexOf("右") > -1) {
                hatenaCounter = 0;
                str += "<p class='blockComment'>" + "ブロック：「右か！" + comment + "」" + "</p>";
                str += "<p class='yourComment'>" + "あなた：「右！」" + "</p>";
                keyDownRight();
            } else if (transcript.indexOf("回れ") > -1) {
                hatenaCounter = 0;
                str += "<p class='blockComment'>" + "ブロック：「回転か！" + comment + "」" + "</p>";
                str += "<p class='yourComment'>" + "あなた：「回れ！」" + "</p>";
                keyDownRotate();
            } else {
                hatenaCounter++;

                if (hatenaCounter == 3) {
                    str += "<p class='blockComment'>" + "ブロック：「？？？」" + "</p>";
                }

                if (hatenaCounter == 5) {
                    hatenaCounter = 0;
                    str += "<p class='blockComment'>" + "ブロック：「何言ってるかわからんて！」" + "</p>";
                }

                str += "<p class='yourComment'>" + "あなた：「" + transcript + "」" + "</p>";
            }

            el.innerHTML = str + el.innerHTML;
        }

        recognition.stop();
    }
}

