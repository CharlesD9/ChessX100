import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const SIZE = 10;

/**
 * Board representation:
 * board[r][c] where r=0 top (Black home rank), r=SIZE-1 bottom (White home rank).
 * Pieces are strings: "wP", "bK", etc.
 * Prince is "A": "wA" / "bA" and moves like King (1 step any direction).
 */
function initialBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  // Back rank: R N B Pr Q K Pr B N R
  const backRank = (color) => [
    `${color}R`,
    `${color}N`,
    `${color}B`,
    `${color}A`, // Prince
    `${color}Q`,
    `${color}K`,
    `${color}A`, // Prince
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

const game = {
  size: SIZE,
  board: initialBoard(),
  turn: "w", // 'w' or 'b'
  moveNumber: 1
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

function isValidPawnMove(board, from, to, color) {
  const dir = color === "w" ? -1 : 1;          // white goes up (toward r=0)
  const startRow = color === "w" ? SIZE - 2 : 1;

  const dr = to.r - from.r;
  const dc = to.c - from.c;

  const target = board[to.r][to.c];

  // forward move (no capture)
  if (dc === 0) {
    if (dr === dir && target === null) return true;

    // double-step from start row
    if (from.r === startRow && dr === 2 * dir) {
      const midR = from.r + dir;
      if (target === null && board[midR][from.c] === null) return true;
    }
    return false;
  }

  // diagonal capture
  if (Math.abs(dc) === 1 && dr === dir) {
    return target !== null && colorOf(target) !== color;
  }

  return false;
}

function isValidMove(board, from, to, turnColor) {
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
      const ok = isValidPawnMove(board, from, to, pieceColor);
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
      // Prince: exactly like king (1 step any direction)
      const ok = adr <= 1 && adc <= 1;
      return ok ? { ok: true } : { ok: false, reason: "Illegal prince move." };
    }

    default:
      return { ok: false, reason: "Unknown piece." };
  }
}

app.get("/api/state", (req, res) => {
  res.json(game);
});

app.post("/api/move", (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ ok: false, reason: "Missing from/to." });

  const verdict = isValidMove(game.board, from, to, game.turn);
  if (!verdict.ok) return res.json({ ok: false, reason: verdict.reason });

  const movingPiece = game.board[from.r][from.c];
  game.board[to.r][to.c] = movingPiece;
  game.board[from.r][from.c] = null;

  game.turn = game.turn === "w" ? "b" : "w";
  if (game.turn === "w") game.moveNumber += 1;

  return res.json({ ok: true, game });
});

app.post("/api/reset", (req, res) => {
  game.board = initialBoard();
  game.turn = "w";
  game.moveNumber = 1;
  res.json({ ok: true, game });
});

app.listen(PORT, () => {
  console.log(`Chess Lite 10x10 running at http://localhost:${PORT}`);
});
