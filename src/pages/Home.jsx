import Auth from '../components/Auth';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-black mb-6 tracking-tight">expenso</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Track expenses, understand your spending habits, and take control of your financial journey with our intuitive expense tracker.
          </p>
        </div>

        <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-8 mb-16">
          <Auth />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3 text-black">Smart Tracking</h3>
            <p className="text-gray-600">Effortlessly monitor your expenses and income with intelligent categorization.</p>
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3 text-black">Visual Insights</h3>
            <p className="text-gray-600">Understand your spending patterns through beautiful, intuitive charts.</p>
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3 text-black">Budget Goals</h3>
            <p className="text-gray-600">Set and track financial goals with customizable budgets and alerts.</p>
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3 text-black">Mood Tracking</h3>
            <p className="text-gray-600">Understand the emotional aspects of your spending habits.</p>
          </div>
        </div>
      </div>
    </div>
  );
}