using Microsoft.AspNetCore.Mvc;
using Minesweeper.Filters;
using Minesweeper.Models;

namespace Minesweeper.Controllers
{
    public class GameController : Controller
    {

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
            return View("Game", model);
        }



    }
}
