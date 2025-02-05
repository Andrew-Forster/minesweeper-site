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

        [SessionCheckFilter]
        public IActionResult Index()
        {
            return View();
        }

        /// <summary>
        /// Starts a new game.
        /// </summary>
        /// <param name="model"></param>
        /// <returns></returns>
        [SessionCheckFilter]
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

            board.Reveal(row + 1, col + 1);

            if (board.Cells[row, col].IsFlagged)
            {
                return Json(new { error = "Cell is flagged." });
            }

            if (board.CheckGameState() == "Won")
            {
                gameState = "won";
            }
            else if (board.CheckGameState() == "Lost")
            {
                gameState = "lost";
            }
            HttpContext.Session.SetString(SessionKey, JsonConvert.SerializeObject(board));
            var cells = board.Cells.Cast<Cell>().ToList();

            return Json(new { gameState, cells, board.Points });
        }
    }
}
