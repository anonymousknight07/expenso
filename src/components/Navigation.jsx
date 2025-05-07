import { Link } from 'react-router-dom';

export default function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/dashboard" className="flex items-center px-2 text-black font-semibold">
              expenso
            </Link>
            <div className="hidden sm:flex sm:space-x-8">
              <Link to="/expenses" className="inline-flex items-center px-1 pt-1 text-gray-600 hover:text-black">
                Expenses
              </Link>
              <Link to="/income" className="inline-flex items-center px-1 pt-1 text-gray-600 hover:text-black">
                Income
              </Link>
              <Link to="/budget" className="inline-flex items-center px-1 pt-1 text-gray-600 hover:text-black">
                Budget
              </Link>
              <Link to="/analytics" className="inline-flex items-center px-1 pt-1 text-gray-600 hover:text-black">
                Analytics
              </Link>
              <Link to="/goals" className="inline-flex items-center px-1 pt-1 text-gray-600 hover:text-black">
                Goals
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}