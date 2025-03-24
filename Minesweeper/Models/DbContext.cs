using Microsoft.EntityFrameworkCore;
using Minesweeper.Models;

namespace Minesweeper.Models
{
	public class ApplicationDbContext : DbContext
	{
		public DbSet<UserModel> Users { get; set; }

		public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }
	}

}
