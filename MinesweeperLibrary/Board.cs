using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MinesweeperLibrary
{
    public class Board
    {
        public int BoardSize { get; set; } = 9;
        public int BombCount { get; set; } = 10;
        public int Difficulty { get; set; }
        public int RewardCount { get; set; }
        public Cell[,] Cells { get; set; }
        public bool GameOver { get; set; }
        public List<string> RewardsInventory { get; set; }
        public bool Shuffled { get; set; } = false;
        public int Points { get; set; } = 0;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }

        /// <summary>
        /// Default Constructor for Board
        /// Sets Difficulty to 1 (Easy)
        /// Initializes Board
        /// </summary>
        public Board()
        {
            Difficulty = 1;
            GameOver = false;
            RewardsInventory = new List<string>();
            RewardCount = 0;
            InitBoard();
        }

        /// <summary>
        /// Sets up game board based on difficulty
        /// </summary>
        /// <param name="difficulty"></param>
        public Board(int difficulty)
        {
            Difficulty = difficulty;
            GameOver = false;
            RewardsInventory = new List<string>();
            RewardCount = difficulty;
            InitBoard();
        }

        public Board(int boardSize, int bombCount)
        {
            BombCount = bombCount;
            BoardSize = boardSize;
            GameOver = false;
            RewardsInventory = new List<string>();
            RewardCount = (BombCount / BoardSize) + 1;
            InitBoard();
        }

        /// <summary>
        /// Initializes the game board with cells and bombs,
        /// then shuffles the board to randomize bomb placement
        /// </summary>
        public void InitBoard()
        {
            Cells = new Cell[BoardSize, BoardSize];

            int i = 0;
            for (int row = 0; row < BoardSize; row++)
            {
                for (int col = 0; col < BoardSize; col++)
                {
                    Cells[row, col] = new Cell(false, false, false, 0, "None", row, col);
                }
            }

            Random random = new Random();

            while (i < BombCount)
            {
                int row = random.Next(BoardSize);
                int col = random.Next(BoardSize);

                if (!Cells[row, col].IsMine)
                {
                    Cells[row, col] = new Cell(true, false, false, 0, "None", row, col);
                    i++;
                }
            }
        }

        /// <summary>
        /// Overloaded Shuffle Board method to shuffle board 5 times by default
        /// </summary>
        public void ShuffleBoard(Point startClick = new Point())
        {
            ShuffleBoard(10, startClick);
        }

        /// <summary>
        /// Shuffles Game Board to randomize bomb placement
        /// Ensures that the start click will never be a mine
        /// if a point is passed in
        /// * MUST CALL THIS METHOD *
        /// </summary>
        /// <param name="num"></param>
        public void ShuffleBoard(int num, Point startClick = new Point())
        {
            StartTime = DateTime.Now;
            int distance = 3;

            if (BoardSize < 10)
            {
                distance = 2;
            }

            Random random = new Random();
            Shuffled = true;

            // Shuffle board num times
            for (int i = 0; i < num; i++)
            {
                var cellList = Cells.Cast<Cell>().ToList();

                for (int currentIndex = cellList.Count - 1; currentIndex > 0; currentIndex--)
                {
                    int randomIndex = random.Next(currentIndex + 1);
                    if (
                        startClick != new Point()
                        && Math.Abs(randomIndex / BoardSize - startClick.X) < distance
                        && Math.Abs(randomIndex % BoardSize - startClick.Y) < distance
                        && !Cells[currentIndex / BoardSize, currentIndex % BoardSize].IsMine
                        && !Cells[randomIndex / BoardSize, currentIndex % BoardSize].IsMine
                    )
                    {
                        (cellList[currentIndex], cellList[randomIndex]) = (
                            cellList[randomIndex],
                            cellList[currentIndex]
                        );
                    }
                }

                // Reassign shuffled board back to Cells
                for (int row = 0; row < BoardSize; row++)
                {
                    for (int col = 0; col < BoardSize; col++)
                    {
                        Cells[row, col] = cellList[row * BoardSize + col];
                        Cells[row, col].row = row;
                        Cells[row, col].col = col;
                    }
                }
            }

            CalculateAdjacentMines();
            SetRewards(RewardCount + 1);
        }

        /// <summary>
        /// Calculates the number of adjacent mines for each cell
        /// and sets the AdjacentMines property of each cell
        /// </summary>
        public void CalculateAdjacentMines()
        {
            for (int row = 0; row < BoardSize; row++)
            {
                for (int col = 0; col < BoardSize; col++)
                {
                    if (Cells[row, col].IsMine)
                    {
                        Cells[row, col].AdjacentMines = -1;
                    }
                    else
                    {
                        int count = 0;
                        for (int i = -1; i <= 1; i++)
                        {
                            for (int j = -1; j <= 1; j++)
                            {
                                if (
                                    row + i >= 0
                                    && row + i < BoardSize
                                    && col + j >= 0
                                    && col + j < BoardSize
                                )
                                {
                                    if (Cells[row + i, col + j].IsMine)
                                    {
                                        count++;
                                    }
                                }
                            }
                        }

                        Cells[row, col].AdjacentMines = count;
                    }
                }
            }
        }

        /// <summary>
        /// Sets the rewards on the board
        /// Only on cells that do not have a number
        /// </summary>
        /// <param name="count"></param>
        public void SetRewards(int count)
        {
            Random random = new Random();
            int maxSpots = 0;
            for (int i = 0; i < BoardSize; i++)
            {
                for (int j = 0; j < BoardSize; j++)
                {
                    if (Cells[i, j].AdjacentMines == 0 && !Cells[i, j].IsMine)
                    {
                        maxSpots++;
                    }
                }
            }

            count = maxSpots < count ? maxSpots : count;

            for (int i = 0; i < count; i++)
            {
                while (true)
                {
                    int row = random.Next(BoardSize);
                    int col = random.Next(BoardSize);

                    if (Cells[row, col].AdjacentMines == 0 && !Cells[row, col].IsMine)
                    {
                        string[] rewards =
                        {
                            "Detector",
                            "Detector",
                            "Scavenge",
                            "Scavenge",
                            "Sweep",
                        };
                        int rewardIndex = random.Next(rewards.Length);
                        Cells[row, col] = new Cell(
                            false,
                            false,
                            false,
                            0,
                            rewards[rewardIndex],
                            row,
                            col
                        );
                        Cells[row, col].row = row;
                        Cells[row, col].col = col;

                        break;
                    }
                }
            }
        }

        /// <summary>
        /// Reveals cell
        /// If cell is a mine, game is over
        /// </summary>
        /// <param name="cell"></param>
        /// <returns></returns>
        public List<Cell> Reveal(int row, int col)
        {
            Cell cell = Cells[row - 1, col - 1];
            List<Cell> changedCells = new List<Cell>();

            if (cell.RewardType != "None" && !cell.RewardUsed)
            {
                RewardsInventory.Add(cell.RewardType);
                cell.RewardUsed = true;
            }
            
            if (cell.IsRevealed)
            {
                return changedCells;
            }

            if (cell.IsMine)
            {
                cell.IsRevealed = true;
                GameOver = true;
                changedCells.Add(cell);
                return changedCells;
            }

            changedCells = FloodFill(row - 1, col - 1);
            cell.IsRevealed = true;

            if (!cell.PointsGiven)
            {
                Points += (cell.AdjacentMines * 100);
                cell.PointsGiven = true;
            }

            if (!changedCells.Contains(cell))
            {
                changedCells.Add(cell);
            }
            return changedCells;
        }

        /// <summary>
        /// Flags a cell
        /// </summary>
        /// <param name="row"></param>
        /// <param name="col"></param>
        public void Flag(int row, int col)
        {
            Cell cell = Cells[row, col];
            if (cell.IsRevealed)
            {
                return;
            }

            cell.IsFlagged = !cell.IsFlagged;
        }

        public List<Cell> UseReward(string reward, int row, int col)
        {
            if (!RewardsInventory.Contains(reward))
            {
                return new List<Cell>();
            }
            RewardsInventory.Remove(reward);
            List<Cell> changedCells = new List<Cell>();
            switch (reward)
            {
                case "Detector":
                    Cells[row, col].IsRevealed = true;
                    changedCells.Add(Cells[row, col]);
                    break;
                case "Scavenge":
                    // Reveals a random mine
                    while (true)
                    {
                        Random random = new Random();
                        int newRow = random.Next(BoardSize);
                        int newCol = random.Next(BoardSize);

                        if (
                            Cells[newRow, newCol].IsMine
                            && !Cells[newRow, newCol].IsRevealed
                            && !Cells[newRow, newCol].IsFlagged
                        )
                        {
                            Cells[newRow, newCol].IsRevealed = true;
                            changedCells.Add(Cells[newRow, newCol]);
                            break;
                        }
                    }
                    break;
                case "Sweep":
                    // Reveals all open caverns
                    for (int i = 0; i < BoardSize; i++)
                    {
                        for (int j = 0; j < BoardSize; j++)
                        {
                            if (
                                !Cells[i, j].IsMine
                                && Cells[i, j].IsRevealed == false
                                && Cells[i, j].AdjacentMines == 0
                            )
                            {
                                changedCells = FloodFill(i, j);
                            }
                        }
                    }
                    break;
                default:
                    break;
            }

            return changedCells;
        }

        /// <summary>
        /// Checks if the game is over
        /// Returns
        /// </summary>
        /// <returns></returns>
        public string CheckGameState()
        {
            int count = 0;
            int flagged = 0;
            for (int row = 0; row < BoardSize; row++)
            {
                for (int col = 0; col < BoardSize; col++)
                {
                    if (Cells[row, col].IsRevealed && !Cells[row, col].IsMine)
                    {
                        count++;
                    }

                    if (
                        Cells[row, col].IsFlagged && Cells[row, col].IsMine
                        || Cells[row, col].IsMine && Cells[row, col].IsRevealed
                    )
                    {
                        flagged++;
                    }

                    if (Cells[row, col].IsFlagged && !Cells[row, col].IsMine)
                    {
                        flagged--;
                    }
                }
            }

            if (flagged == BombCount)
            {
                EndTime = DateTime.Now;
                Points -= (int)StartTime.Subtract(StartTime).TotalSeconds * 10;
                return "Won";
            }

            if (count >= (BoardSize * BoardSize) - BombCount)
            {
                EndTime = DateTime.Now;
                Points -= (int)EndTime.Subtract(StartTime).TotalSeconds * 10;
                return "Won";
            }

            if (GameOver)
            {
                EndTime = DateTime.Now;
                Points -= (int)EndTime.Subtract(StartTime).TotalSeconds * 10;
                return "Lost";
            }

            return "Continue";
        }

        public List<Cell> FloodFill(int row, int col)
        {
            List<Cell> updatedCells = new List<Cell>();
            FloodFillHelper(row, col, updatedCells);
            return updatedCells;
        }

        private void FloodFillHelper(int row, int col, List<Cell> updatedCells)
        {
            if (
                row < 0
                || row >= BoardSize
                || col < 0
                || col >= BoardSize
                || Cells[row, col].IsMine
                || Cells[row, col].IsRevealed
            )
            {
                return;
            }

            Cell c = Cells[row, col];
            c.IsFlagged = false;
            c.IsRevealed = true;
            updatedCells.Add(c);

            if (c.AdjacentMines != 0)
            {
                if (!c.PointsGiven)
                {
                    Points += (c.AdjacentMines * 100);
                    c.PointsGiven = true;
                }

                return;
            }

            for (int i = -1; i <= 1; i++)
            {
                for (int j = -1; j <= 1; j++)
                {
                    if (row + i >= 0 && row + i < BoardSize && col + j >= 0 && col + j < BoardSize)
                    {
                        FloodFillHelper(row + i, col + j, updatedCells);
                    }
                }
            }
        }
    }
}