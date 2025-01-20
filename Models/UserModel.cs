using System.Security.Cryptography;
using System.Text;

namespace Minesweeper.Models
{
	public class UserModel
	{
		public int Id { get; set; }
		public string FirstName { get; set; }
		public string LastName { get; set; }
		public string Sex { get; set; }
		public int Age { get; set; }
		public string State { get; set; }
		public string EmailAddress { get; set; }
		public string Username { get; set; }
		public string PasswordHash { get; set; }
		public byte[] Salt { get; set; }

		public void SetPassword(string password)
		{
			using (var rng = RandomNumberGenerator.Create())
			{
				Salt = new byte[16];
				rng.GetBytes(Salt);
			}

			using (var sha256 = SHA256.Create())
			{
				var saltedPassword = password + Convert.ToBase64String(Salt);
				PasswordHash = Convert.ToBase64String(sha256.ComputeHash(Encoding.UTF8.GetBytes(saltedPassword)));
			}
		}

		public bool VerifyPassword(string password)
		{
			using (var sha256 = SHA256.Create())
			{
				var saltedPassword = password + Convert.ToBase64String(Salt);
				var hash = Convert.ToBase64String(sha256.ComputeHash(Encoding.UTF8.GetBytes(saltedPassword)));
				return hash == PasswordHash;
			}
		}
	}

}
