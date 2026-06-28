export function checkWin(
  solvedIndices: number[],
  gridSize: number = 5,
  mode: "classic" | "lines_only" = "classic",
): { hasWon: boolean; winningLine: number[] | null; linesCompleted: number } {
  let linesCompleted = 0;
  let winningLine: number[] | null = null;
  const solvedSet = new Set(solvedIndices);

  const checkLine = (line: number[]) => {
    const isComplete = line.every((index) => solvedSet.has(index));
    if (isComplete) {
      linesCompleted++;
      if (!winningLine) winningLine = line;
    }
  };

  // Rows
  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      row.push(r * gridSize + c);
    }
    checkLine(row);
  }

  // Columns
  for (let c = 0; c < gridSize; c++) {
    const col = [];
    for (let r = 0; r < gridSize; r++) {
      col.push(r * gridSize + c);
    }
    checkLine(col);
  }

  // Diagonals (only if classic)
  if (mode === "classic") {
    const diag1 = [];
    const diag2 = [];
    for (let i = 0; i < gridSize; i++) {
      diag1.push(i * gridSize + i);
      diag2.push(i * gridSize + (gridSize - 1 - i));
    }
    checkLine(diag1);
    checkLine(diag2);
  }

  return {
    hasWon: linesCompleted > 0,
    winningLine,
    linesCompleted,
  };
}
