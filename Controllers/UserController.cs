using Microsoft.AspNetCore.Mvc;
using Minesweeper.Filters;
using Minesweeper.Models;
using System.Text.Json;

namespace Minesweeper.Controllers
{
	public class UserController : Controller
	{
		private readonly ApplicationDbContext _context;

		public UserController(ApplicationDbContext context)
		{
			_context = context;
		}

		public IActionResult Index()
		{
			return View();
		}

        /// <summary>
        /// Registers a new user.
        /// </summary>
        /// <param name="model"></param>
        /// <returns></returns>
        [HttpPost]
		public async Task<IActionResult> Register(RegisterViewModel model)
		{
			if (ModelState.IsValid)
			{
				var user = new UserModel
				{
					FirstName = model.FirstName,
					LastName = model.LastName,
					Sex = model.Sex,
					Age = model.Age,
					State = model.State,
					EmailAddress = model.EmailAddress,
					Username = model.Username
				};
				user.SetPassword(model.Password);

				_context.Users.Add(user);
				await _context.SaveChangesAsync();

				return View("RegisterSuccess");
            }

			return View(model);
		}

        /// <summary>
        /// Logs in a user.
        /// </summary>
        /// <param name="model"></param>
        /// <returns></returns>
        [HttpPost]
		public IActionResult Login(LoginViewModel model)
		{
			if (ModelState.IsValid)
			{
				var user = _context.Users.FirstOrDefault(u => u.Username == model.Username);
				if (user != null && user.VerifyPassword(model.Password))
				{
					HttpContext.Session.SetString("User", JsonSerializer.Serialize(user));

					return View("LoginSuccess");
                }
			}

			TempData["ErrorMessage"] = "Invalid username or password.";
			return RedirectToAction("Login");
		}

        /// <summary>
        /// Shows the user's account information
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public IActionResult Account()
        {
            var userSession = HttpContext.Session.GetString("User");

            if (string.IsNullOrEmpty(userSession))
            {
                return RedirectToAction("Login", "User");
            }

            return View("Index");
        }

		/// <summary>
		/// Shows the login page
		/// </summary>
		/// <returns></returns>
        [HttpGet]
        public IActionResult Login()
        {
            return View("Login");
        }

        /// <summary>
        /// Shows the registration page
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public IActionResult Register()
        {
            return View("Register");
        }

        /// <summary>
        /// Logs the user out
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public IActionResult Logout()
        {
            HttpContext.Session.Remove("User");
            return RedirectToAction("Login");
        }



    }
}
