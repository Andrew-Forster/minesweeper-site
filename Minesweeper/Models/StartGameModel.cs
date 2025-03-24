using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Minesweeper.Models
{
    public class StartGameModel
    {
        [BindProperty]
        public int BoardSize { get; set; } = 10;

        [BindProperty]
        public int MineCount { get; set; } = 10;

        [BindProperty]
        public string Difficulty { get; set; }
    }
}
