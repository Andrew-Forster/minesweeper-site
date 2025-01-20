using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc;

namespace Minesweeper.Filters
{
	public class SessionCheckFilter : ActionFilterAttribute
	{
		public override void OnActionExecuting(ActionExecutingContext context)
		{
			var sessionUser = context.HttpContext.Session.GetString("User");
			if (string.IsNullOrEmpty(sessionUser))
			{
				context.Result = new RedirectToActionResult("Login", "User", null);
			}
		}
	}

}
