    using System.Drawing;
using Microsoft.AspNetCore.Mvc;
using Minesweeper.Filters;
using Minesweeper.Models;
using MinesweeperLibrary;
using Newtonsoft.Json;

namespace Minesweeper.Controllers
{
    public class GameController : Controller
    {
        private const string SessionKey = "GameBoard";

        // [SessionCheckFilter]
        public IActionResult? Index()
        {
            return View();
        }

        /// <summary>
        /// Starts a new game.
        /// </summary>
        /// <param name="model"></param>
        /// <returns></returns>
        // [SessionCheckFilter]
        [HttpPost]
        public IActionResult Index(StartGameModel model)
        {
            string difficulty = model.Difficulty;
            switch (difficulty)
            {
                case "Easy":
                    model.BoardSize = 9;
                    model.MineCount = 10;
                    break;
                case "Medium":
                    model.BoardSize = 16;
                    model.MineCount = 40;
                    break;
                case "Hard":
                    model.BoardSize = 24;
                    model.MineCount = 99;
                    break;
                case "Custom":
                    break;
                default:
                    model.Difficulty = "Easy";
                    model.BoardSize = 9;
                    model.MineCount = 10;
                    break;
            }

            var gameBoard = new Board(model.BoardSize, model.MineCount);
            HttpContext.Session.SetString(SessionKey, JsonConvert.SerializeObject(gameBoard));

            return View("Game", model);
        }

        [HttpPost]
        public JsonResult RevealCell(int row, int col)
        {
            var gameBoardJson = HttpContext.Session.GetString(SessionKey);

            if (string.IsNullOrEmpty(gameBoardJson))
            {
                return Json(new { error = "Game not found." });
            }

            var board = JsonConvert.DeserializeObject<Board>(gameBoardJson);


            if (board.Cells[row, col].RewardType != "None" && !board.Cells[row, col].RewardUsed && board.Shuffled)
            {
                board.Reveal(row + 1, col + 1);
                HttpContext.Session.SetString(SessionKey, JsonConvert.SerializeObject(board));
                return Json(new { gameState = board.CheckGameState().ToLower(), rewards = board.RewardsInventory, cells = new List<Cell> { board.Cells[row, col] }, score = board.Points });
            }
            
            if (!board.Shuffled)
            {
                board.ShuffleBoard(new Point(row, col));
            }

            if (board.Cells[row, col].IsRevealed)
            {
                return Json(new { invalid = "Cell is already revealed." });
            }

            if (board.Cells[row, col].IsFlagged)
            {
                return Json(new { invalid = "Cell is flagged." });
            }
            
            List<Cell> changedCells = board.Reveal(row + 1, col + 1);
            
            String gameState = board.CheckGameState().ToLower();
            if (gameState is "won" or "lost")
            {
                var allCells = board.Cells.Cast<Cell>().ToList();
                return Json(new { gameState, cells = allCells, score = board.Points });
            }
            HttpContext.Session.SetString(SessionKey, JsonConvert.SerializeObject(board));
            var cells = changedCells.Cast<Cell>().ToList();
            

            return Json(new { gameState, cells, score = board.Points, startTime = board.StartTime });
        }        
        
        [HttpPost]
        public JsonResult RightClick(int row, int col)
        {
            var gameBoardJson = HttpContext.Session.GetString(SessionKey);
            String gameState = "continue";


            if (string.IsNullOrEmpty(gameBoardJson))
            {
                return Json(new { error = "Game not found." });
            }

            var board = JsonConvert.DeserializeObject<Board>(gameBoardJson);

            if (!board.Shuffled)
            {
                board.ShuffleBoard(new Point(row, col));
            }

            board.Flag(row, col);
            
            HttpContext.Session.SetString(SessionKey, JsonConvert.SerializeObject(board));
            var cells = new List<Cell>();
            cells.Add(board.Cells[row, col]);
            return Json(new { gameState, cells, score = board.Points });
        }

        [HttpPost]
        public JsonResult UseReward(string reward, int row, int col)
        {   
            var gameBoardJson = HttpContext.Session.GetString(SessionKey);
            var board = JsonConvert.DeserializeObject<Board>(gameBoardJson);
            var changedCells = board.UseReward(reward, row, col);
            HttpContext.Session.SetString(SessionKey, JsonConvert.SerializeObject(board));
            String gameState = board.CheckGameState().ToLower();
            
            return Json(new { gameState, cells = changedCells, score = board.Points, rewards = board.RewardsInventory });
        }
    }
}
