const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const messageEl = document.getElementById("message");
const resetBtn = document.getElementById("resetBtn");

let state = null;
let selected = null;

const PIECE_TO_UNICODE = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",

  // Prince (no standard chess Unicode piece): show as text
  wA: "☆",
  bA: "★"
};

function filesForSize(size) {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, size);
}

function rcToAlg(r, c, size) {
  const file = filesForSize(size)[c];
  const rank = (size - r).toString();
  return file + rank;
}

function setMessage(text, isError = false) {
  messageEl.textContent = text || "";
  messageEl.style.color = isError ? "#b91c1c" : "#111827";
}

async function fetchState() {
  const res = await fetch("/api/state");
  state = await res.json();
  render();
}

function render() {
  if (!state) return;

  const size = state.size ?? 10;
  const turn = state.turn === "w" ? "White" : "Black";
  statusEl.textContent = `Turn: ${turn} — Move ${state.moveNumber}`;

  boardEl.style.gridTemplateColumns = `repeat(${size}, var(--sq))`;
  boardEl.style.gridTemplateRows = `repeat(${size}, var(--sq))`;

  boardEl.innerHTML = "";
  const board = state.board;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const sq = document.createElement("div");
      sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");
      sq.dataset.r = r;
      sq.dataset.c = c;

      const piece = board[r][c];
      //sq.textContent = piece ? (PIECE_TO_UNICODE[piece] ?? piece) : "";
      if (!piece) {
        sq.textContent = "";
      } else if (piece.endsWith("A")) {
        // Prince
        sq.innerHTML = `<span class="prince">${PIECE_TO_UNICODE[piece] ?? piece}</span>`;
      } else {
        sq.textContent = PIECE_TO_UNICODE[piece] ?? piece;
      }

      // Add coordinate labels (A–J along bottom, 10–1 along left)
      if (r === size - 1) {
        const fileLabel = document.createElement("span");
        fileLabel.className = "label-file";
        fileLabel.textContent = filesForSize(size)[c];
        sq.appendChild(fileLabel);
      }
      
      if (c === 0) {
        const rankLabel = document.createElement("span");
        rankLabel.className = "label-rank";
        rankLabel.textContent = String(size - r); // 10 at top, 1 at bottom
        sq.appendChild(rankLabel);
      }

      if (selected && selected.r === r && selected.c === c) {
        sq.classList.add("selected");
      }

      sq.addEventListener("click", onSquareClick);
      boardEl.appendChild(sq);
    }
  }
}

async function tryMove(from, to) {
  const res = await fetch("/api/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to })
  });

  const data = await res.json();
  if (!data.ok) {
    setMessage(data.reason || "Illegal move.", true);
    return false;
  }

  state = data.game;
  setMessage(`Moved ${rcToAlg(from.r, from.c, state.size)} → ${rcToAlg(to.r, to.c, state.size)}`);
  return true;
}

async function onSquareClick(e) {
  if (!state) return;

  const r = Number(e.currentTarget.dataset.r);
  const c = Number(e.currentTarget.dataset.c);
  const piece = state.board[r][c];

  // First click: select a piece (must be current player's)
  if (!selected) {
    if (!piece) return;

    const myTurn = state.turn;
    if ((myTurn === "w" && !piece.startsWith("w")) || (myTurn === "b" && !piece.startsWith("b"))) {
      setMessage("It’s not your turn for that piece.", true);
      return;
    }

    selected = { r, c };
    setMessage(`Selected ${rcToAlg(r, c, state.size)} (${piece})`);
    render();
    return;
  }

  // Clicking same square cancels selection
  if (selected.r === r && selected.c === c) {
    selected = null;
    setMessage("");
    render();
    return;
  }

  // Second click: attempt move
  const ok = await tryMove(selected, { r, c });
  selected = null;
  render();
  if (!ok) return;
}

resetBtn.addEventListener("click", async () => {
  await fetch("/api/reset", { method: "POST" });
  selected = null;
  setMessage("Reset game.");
  await fetchState();
});

fetchState().catch((err) => {
  console.error(err);
  setMessage("Failed to load game state.", true);
});
