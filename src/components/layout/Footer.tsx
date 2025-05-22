import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-black text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">
              EX<span className="text-yellow">PENSO</span>
            </h3>
            <p className="text-gray-300 mb-4">
              Your personal finance tracker. Take control of your money and achieve your financial goals.
            </p>
            <div className="flex gap-2">
  {/* Instagram */}
  <a href="https://www.instagram.com/akshat___pandey07/" target="_blank" rel="noopener noreferrer">
    <div className="w-8 h-8 flex items-center justify-center rounded-full border border-white text-white hover:bg-black hover:text-yellow transition-colors duration-300">
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="16" height="16" viewBox="0 0 24 24">
        <path d="M12 2.2c3.2 0 3.584.012 4.85.07 1.17.055 1.968.24 2.43.4a4.9 4.9 0 0 1 1.78 1.15 4.9 4.9 0 0 1 1.15 1.78c.16.462.345 1.26.4 2.43.058 1.266.07 1.65.07 4.85s-.012 3.584-.07 4.85c-.055 1.17-.24 1.968-.4 2.43a4.9 4.9 0 0 1-1.15 1.78 4.9 4.9 0 0 1-1.78 1.15c-.462.16-1.26.345-2.43.4-1.266.058-1.65.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.055-1.968-.24-2.43-.4a4.9 4.9 0 0 1-1.78-1.15 4.9 4.9 0 0 1-1.15-1.78c-.16-.462-.345-1.26-.4-2.43C2.212 15.784 2.2 15.4 2.2 12s.012-3.584.07-4.85c.055-1.17.24-1.968.4-2.43a4.9 4.9 0 0 1 1.15-1.78 4.9 4.9 0 0 1 1.78-1.15c.462-.16 1.26-.345 2.43-.4C8.416 2.212 8.8 2.2 12 2.2zm0-2.2C8.735 0 8.332.012 7.052.07 5.748.128 4.757.318 3.94.603 3.102.894 2.388 1.304 1.706 1.986.938 2.755.528 3.47.237 4.308.05 4.996-.128 5.98-.186 7.288-.244 8.568-.256 8.97-.256 12c0 3.03.012 3.432.07 4.712.058 1.308.237 2.292.424 2.98.29.838.7 1.553 1.382 2.235.77.77 1.485 1.182 2.323 1.473.688.186 1.672.366 2.98.424C8.568 23.988 8.97 24 12 24s3.432-.012 4.712-.07c1.308-.058 2.292-.237 2.98-.424.838-.29 1.553-.7 2.235-1.382.77-.77 1.182-1.485 1.473-2.323.186-.688.366-1.672.424-2.98.058-1.28.07-1.682.07-4.712s-.012-3.432-.07-4.712c-.058-1.308-.237-2.292-.424-2.98a5.99 5.99 0 0 0-1.473-2.323A5.99 5.99 0 0 0 19.692.603C18.854.318 17.87.128 16.562.07 15.282.012 14.88 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.775a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/>
      </svg>
    </div>
  </a>

  {/* LinkedIn */}
  <a href="https://www.linkedin.com/in/akshatpandey07/" target="_blank" rel="noopener noreferrer">
    <div className="w-8 h-8 flex items-center justify-center rounded-full border border-white text-white hover:bg-black hover:text-yellow transition-colors duration-300">
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="16" height="16" viewBox="0 0 24 24">
        <path d="M4.983 3.5C3.879 3.5 3 4.38 3 5.483s.879 1.983 1.983 1.983h.02A1.986 1.986 0 0 0 7 5.484C7 4.38 6.12 3.5 5.017 3.5h-.034zm.017 4.749H3V21h2V8.25zM8.25 8.25H10.3v1.743h.028c.286-.54.986-1.107 2.03-1.107 2.17 0 2.57 1.43 2.57 3.288V21h-2V12.75c0-1.15-.02-2.628-1.6-2.628-1.6 0-1.844 1.25-1.844 2.543V21h-2V8.25z"/>
      </svg>
    </div>
  </a>

  {/* X / Twitter */}
  <a href="https://x.com/akshath_pandey" target="_blank" rel="noopener noreferrer">
    <div className="w-8 h-8 flex items-center justify-center rounded-full border border-white text-white hover:bg-black hover:text-yellow transition-colors duration-300">
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="16" height="16" viewBox="0 0 24 24">
        <path d="M13.14 10.728 22.225 0h-2.036l-7.8 9.57L5.96 0H0l9.41 13.527L0 24h2.036l8.186-10.045L18.273 24H24L13.14 10.728z"/>
      </svg>
    </div>
  </a>
</div>

          </div>
          
          <div>
            {/* <h3 className="text-lg font-semibold mb-4">Features</h3>
            <ul className="space-y-2">
              <li><Link to="/expenses" className="text-gray-300 hover:text-yellow transition-colors">Expense Tracking</Link></li>
              <li><Link to="/income" className="text-gray-300 hover:text-yellow transition-colors">Income Management</Link></li>
              <li><Link to="/budget" className="text-gray-300 hover:text-yellow transition-colors">Budget Planning</Link></li>
              <li><Link to="/reports" className="text-gray-300 hover:text-yellow transition-colors">Reports & Analytics</Link></li>
            </ul> */}
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Account</h3>
            <ul className="space-y-2">
              <li><Link to="/login" className="text-gray-300 hover:text-yellow transition-colors">Login</Link></li>
              <li><Link to="/register" className="text-gray-300 hover:text-yellow transition-colors">Sign Up</Link></li>
              <li><a href="#" className="text-gray-300 hover:text-yellow transition-colors">Password Reset</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <p className="text-gray-300 mb-2">appquery.team@gmail.com</p>
            <p className="text-gray-300">Gurugram, Haryana</p>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} Expenso. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;