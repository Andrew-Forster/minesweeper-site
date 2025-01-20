using System.ComponentModel.DataAnnotations;

namespace Minesweeper.Models
{
	public class RegisterViewModel
	{
		[Required]
		public string FirstName { get; set; }

		[Required]
		public string LastName { get; set; }

		[Required]
		public string Sex { get; set; }

		[Required]
		[Range(1, 120, ErrorMessage = "Age must be between 1 and 120")]
		public int Age { get; set; }

		[Required]
		public string State { get; set; }

		[Required]
		[EmailAddress]
		public string EmailAddress { get; set; }

		[Required]
		public string Username { get; set; }

		[Required]
		[DataType(DataType.Password)]
		public string Password { get; set; }
	}
}
