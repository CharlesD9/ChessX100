import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const SIZE = 10;

/**
 * Board representation:
 * board[r][c] where r=0 top (Black home rank), r=SIZE-1 bottom (White home rank).
 * Noble is "A": "wA" / "bA" and moves like King (1 step any direction).
 */
function initialBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  // Back rank: R N B Pr Q K Pr B N R
  const backRank = (color) => [
    `${color}R`,
    `${color}N`,
    `${color}B`,
    `${color}A`, // Noble
    `${color}Q`,
    `${color}K`,
    `${color}A`, // Noble
    `${color}B`,
    `${color}N`,
    `${color}R`
  ];

  // Black
  board[0] = backRank("b");
  board[1] = Array(SIZE).fill("bP");

  // White
  board[SIZE - 2] = Array(SIZE).fill("wP");
  board[SIZE - 1] = backRank("w");

  return board;
}


function toAlgebraic(r, c) {
  const file = "abcdefghij"[c];
  const rank = (SIZE - r).toString();
  return file + rank;
}

function pieceToNotation(pieceType) {
  switch (pieceType) {
    case "P": return "";   // pawn
    case "R": return "R";
    case "B": return "B";
    case "N": return "N";  
    case "A": return "A";  
    case "Q": return "Q";
    case "K": return "K";  
    default: return "";
  }
}


const game = {
  size: SIZE,
  board: initialBoard(),
  turn: "w", // 'w' or 'b'
  moveNumber: 1, 
  isOver: false,
  enPassantTarget: null, // { r, c } square the opponent pawn can move INTO to capture en passant
  enPassantPawn: null,    // { r, c } location of the pawn that would be captured
  moves: []
};

function inBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function colorOf(piece) {
  return piece?.[0] ?? null;
}

function typeOf(piece) {
  return piece?.[1] ?? null;
}

function pathClear(board, from, to) {
  const dr = Math.sign(to.r - from.r);
  const dc = Math.sign(to.c - from.c);
  let r = from.r + dr;
  let c = from.c + dc;
  while (r !== to.r || c !== to.c) {
    if (board[r][c] !== null) return false;
    r += dr;
    c += dc;
  }
  return true;
}

//function isValidPawnMove(board, from, to, color) {
function isValidPawnMove(board, from, to, color, enPassantTarget, enPassantPawn) {

  const dir = color === "w" ? -1 : 1;          // white goes up (toward r=0)
  const startRow = color === "w" ? SIZE - 2 : 1;

  const dr = to.r - from.r;
  const dc = to.c - from.c;

  const target = board[to.r][to.c];

  // 1) forward move (no capture)
  if (dc === 0) {
    if (dr === dir && target === null) return true;

    // double-step from start row
    if (from.r === startRow && dr === 2 * dir) {
      const midR = from.r + dir;
      if (target === null && board[midR][from.c] === null) return true;
    }
    return false;
  }

  // diagonal capture - No en-passant
  //if (Math.abs(dc) === 1 && dr === dir) {
  //  return target !== null && colorOf(target) !== color;
  //}

  // 2) Normal diagonal capture
  if (Math.abs(dc) === 1 && dr === dir) {
    if (target !== null && colorOf(target) !== color) return true;

    // 3) En passant capture: diagonal move into EMPTY square,
    // but it must match enPassantTarget, and enPassantPawn must be adjacent.
    if (
      target === null &&
      enPassantTarget &&
      enPassantPawn &&
      to.r === enPassantTarget.r &&
      to.c === enPassantTarget.c &&
      // the pawn being captured is the one that just double-stepped
      enPassantPawn.r === from.r &&          // same row as capturing pawn started from
      enPassantPawn.c === to.c               // pawn is in the file you move into
    ) {
      const victim = board[enPassantPawn.r][enPassantPawn.c];
      if (victim && victim[1] === "P" && colorOf(victim) !== color) return true;
    }

    return false;
  }
  
  return false;
}

function isValidMove(board, from, to, turnColor, enPassantTarget, enPassantPawn ) {
  if (!inBounds(from.r, from.c) || !inBounds(to.r, to.c)) {
    return { ok: false, reason: "Out of bounds." };
  }
  if (from.r === to.r && from.c === to.c) {
    return { ok: false, reason: "You must move to a different square." };
  }

  const piece = board[from.r][from.c];
  if (!piece) return { ok: false, reason: "No piece on that square." };

  const pieceColor = colorOf(piece);
  const pieceType = typeOf(piece);

  if (pieceColor !== turnColor) {
    return { ok: false, reason: "Not your piece / not your turn." };
  }

  const target = board[to.r][to.c];
  if (target && colorOf(target) === turnColor) {
    return { ok: false, reason: "You can’t capture your own piece." };
  }

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);

  switch (pieceType) {
    case "P": {
      //const ok = isValidPawnMove(board, from, to, pieceColor);
      const ok = isValidPawnMove(board, from, to, pieceColor, enPassantTarget, enPassantPawn );
      return ok ? { ok: true } : { ok: false, reason: "Illegal pawn move." };
    }

    case "N": {
      const ok = (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
      return ok ? { ok: true } : { ok: false, reason: "Illegal knight move." };
    }

    case "B": {
      const ok = adr === adc && pathClear(board, from, to);
      return ok ? { ok: true } : { ok: false, reason: "Illegal bishop move." };
    }

    case "R": {
      const ok = (dr === 0 || dc === 0) && pathClear(board, from, to);
      return ok ? { ok: true } : { ok: false, reason: "Illegal rook move." };
    }

    case "Q": {
      const ok = ((adr === adc) || (dr === 0 || dc === 0)) && pathClear(board, from, to);
      return ok ? { ok: true } : { ok: false, reason: "Illegal queen move." };
    }

    case "K": {
      // no castling in this version
      const ok = adr <= 1 && adc <= 1;
      return ok ? { ok: true } : { ok: false, reason: "Illegal king move." };
    }

    case "A": {
      // Noble: exactly like king (1 step any direction)
      const ok = adr <= 1 && adc <= 1;
      return ok ? { ok: true } : { ok: false, reason: "Illegal noble move." };
    }

    default:
      return { ok: false, reason: "Unknown piece." };
  }
}

app.get("/api/state", (req, res) => {
  res.json(game);
});

app.post("/api/move", (req, res) => {

  if (game.isOver) {
    return res.json({ ok: false, reason: "Game over. Reset to play again." });
  }

  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ ok: false, reason: "Missing from/to." });

  const piece = game.board[from.r][from.c];
  const pieceType = typeOf(piece);
  const isCapture = game.board[to.r][to.c] !== null;
  const movingPiece = game.board[from.r][from.c];

  const isPawn = pieceType === "P";
  
  // snapshot current EP state (this move may use it)
  const epTarget = game.enPassantTarget;
  const epPawn = game.enPassantPawn;
  
  const isEnPassantCapture =
    isPawn &&
    epTarget &&
    epPawn &&
    game.board[to.r][to.c] === null &&
    Math.abs(to.c - from.c) === 1 &&
    (to.r - from.r) === (movingPiece[0] === "w" ? -1 : 1) &&
    to.r === epTarget.r &&
    to.c === epTarget.c &&
    epPawn.r === from.r &&
    epPawn.c === to.c;

  const verdict = isValidMove(game.board, from, to, game.turn, game.enPassantTarget, game.enPassantPawn);
  if (!verdict.ok) return res.json({ ok: false, reason: verdict.reason });

  const captured = game.board[to.r][to.c]; // may be null
  game.board[to.r][to.c] = movingPiece;
  game.board[from.r][from.c] = null;

  if (isEnPassantCapture) {
    game.board[epPawn.r][epPawn.c] = null; // remove the pawn that double-stepped last move
  }

  // Clear by default: EP is only available immediately after a double-step
  game.enPassantTarget = null;
  game.enPassantPawn = null;


  // If THIS move was a pawn double-step, set EP target for the opponent
  if (movingPiece[1] === "P") {
    const dir = movingPiece[0] === "w" ? -1 : 1;
    const startRow = movingPiece[0] === "w" ? SIZE - 2 : 1;
  
    if (from.r === startRow && Math.abs(to.r - from.r) === 2 && from.c === to.c) {
      // The square "passed over" is the capture target
      game.enPassantTarget = { r: from.r + dir, c: from.c };
      // The pawn that can be captured is sitting at the destination
      game.enPassantPawn = { r: to.r, c: to.c };
    }
  }
   
  let didPromote = false;
  // Auto-promotion: pawn reaching the last rank becomes a queen
  if (movingPiece[1] === "P") {
    const promoteRow = movingPiece[0] === "w" ? 0 : (SIZE - 1);
    if (to.r === promoteRow) {
      game.board[to.r][to.c] = `${movingPiece[0]}Q`;
      didPromote = true;
      // (optional) mark it in move history later as "=Q"
    }
  }


  if (captured && captured[1] === "K") {
    game.isOver = true;
  }

  //if (!game.isOver) {
    game.turn = game.turn === "w" ? "b" : "w";
    if (game.turn === "w") game.moveNumber += 1;
  //}

  let notation = "";

  // Pawn moves
  if (pieceType === "P") {
    if (isCapture) {
      notation = toAlgebraic(from.r, from.c)[0] + "x" + toAlgebraic(to.r, to.c);
    } else {
      notation = toAlgebraic(to.r, to.c);
    }
  } else {
    notation = pieceToNotation(pieceType);
    if (isCapture) notation += "x";
    notation += toAlgebraic(to.r, to.c);
  }
  if (game.isOver) notation += "#";
  if (didPromote) notation += "=Q"; 
  if (isEnPassantCapture) notation += " e.p.";

  game.moves.push(notation);

  return res.json({ ok: true, game });

});

app.post("/api/reset", (req, res) => {
  game.board = initialBoard();
  game.turn = "w";
  game.moveNumber = 1;
  game.isOver = false;
  game.enPassantTarget = null;
  game.enPassantPawn = null;
  game.moves = [];
  res.json({ ok: true, game });
});

app.listen(PORT, () => {
  console.log(`ChessX100 running at http://localhost:${PORT}`);
});
