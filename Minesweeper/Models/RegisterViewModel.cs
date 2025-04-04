﻿using System.ComponentModel.DataAnnotations;

namespace Minesweeper.Models
{
	public class RegisterViewModel
	{
		[Required]
		public string Username { get; set; }

		[Required]
		[DataType(DataType.Password)]
		public string Password { get; set; }
	}
}
