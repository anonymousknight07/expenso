import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import Button from "../components/common/Button";

// Import your generated image
const notFoundImage = "/404.png";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="max-w-xl w-full text-center">
        {/* Illustration */}
        <div className="mb-8">
          <img
            src={notFoundImage}
            alt="404 Not Found"
            className="w-full max-w-md mx-auto object-contain"
          />
        </div>

        {/* Content Card */}
        <div className="border-2 border-black rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0_0_#000] bg-white">
          <h2 className="font-serif text-2xl sm:text-3xl text-black mb-3">
            Oops! Page not found.
          </h2>

          <p className="text-gray-500 text-sm sm:text-base mb-6 leading-relaxed">
            Looks like this expense slipped through the cracks. The page you're
            looking for doesn't exist or may have been moved.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              href="/"
              className="inline-flex items-center w-full sm:w-auto justify-center"
            >
              <Home size={16} className="mr-2" />
              GO HOME
            </Button>

            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="inline-flex items-center w-full sm:w-auto justify-center"
            >
              <ArrowLeft size={16} className="mr-2" />
              GO BACK
            </Button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6">
          <p className="text-xs text-gray-400 mb-2">Popular pages</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { name: "Dashboard", path: "/dashboard" },
              { name: "Expenses", path: "/expenses" },
              { name: "Budget", path: "/budget" },
              { name: "Reports", path: "/reports" },
            ].map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="px-3 py-1.5 text-xs font-medium border-2 border-gray-200 rounded-lg text-gray-500 hover:border-black hover:text-black transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
