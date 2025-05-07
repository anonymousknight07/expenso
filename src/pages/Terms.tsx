import React from 'react';

const Terms: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Terms and Conditions</h1>

      <div className="space-y-4 text-base leading-relaxed">
        <p><strong>Effective Date:</strong> xxxxxx</p>

        <p>Welcome to <strong>Expenso</strong>, your smart companion for managing expenses, tracking income, setting budgets, and boosting your financial wellness through insightful analytics and unique features. These Terms and Conditions ("Terms") govern your use of the Expenso web and mobile application ("Service", "App").</p>

        <p>By accessing or using Expenso, you agree to be bound by these Terms. If you do not agree, please refrain from using our services.</p>

        <h2 className="text-xl font-semibold mt-6">1. Eligibility</h2>
        <p>To use Expenso, you must be at least 13 years old or the age of majority in your jurisdiction, whichever is higher.</p>

        <h2 className="text-xl font-semibold mt-6">2. User Accounts</h2>
        <p><strong>Registration and Login:</strong> You may sign up using Google or an email/password combination. OTP-based phone login is also optionally supported.</p>
        <p><strong>Account Security:</strong> You are responsible for maintaining your credentials and all activity under your account.</p>
        <p><strong>Password Reset:</strong> Available via the app interface. We do not store plain-text passwords.</p>

        <h2 className="text-xl font-semibold mt-6">3. Features & Usage</h2>
        <ul className="list-disc list-inside">
          <li><strong>Dashboard:</strong> Monthly overview, daily/weekly breakdowns, graphs.</li>
          <li><strong>Expense & Income Management:</strong> Add, edit, delete, categorize, upload notes or receipts.</li>
          <li><strong>Budgeting Tools:</strong> Set monthly budgets with progress warnings.</li>
          <li><strong>Reports & Analytics:</strong> Monthly and yearly reports with filters.</li>
          <li><strong>Recurring Transactions:</strong> Support for rent, salary, subscriptions.</li>
          <li><strong>Multi-Device Sync:</strong> Cloud-based sync across devices.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">4. Unique Features</h2>
        <ul className="list-disc list-inside">
          <li><strong>Spending Mood Tracker:</strong> Tag expenses with emotional states.</li>
          <li><strong>Impulse/Guilt Score:</strong> NLP-based analysis of spending behavior.</li>
          <li><strong>Financial Health Meter:</strong> Score with weekly improvement tips.</li>
          <li><strong>Before You Buy Journal:</strong> Wishlist with 48-hour purchase delay.</li>
          <li><strong>Social Challenges & Leaderboards:</strong> Budgeting contests with friends.</li>
          <li><strong>Gamification:</strong> XP, badges, levels.</li>
          <li><strong>Visual Jar System:</strong> Drag-and-drop money into virtual envelopes.</li>
          <li><strong>Goal Tracker:</strong> Set savings goals with progress visualization.</li>
          <li><strong>Budget Copilot:</strong> AI suggestions and nudges.</li>
        </ul>
        <p>These are informational and motivational tools, not professional financial advice.</p>

        <h2 className="text-xl font-semibold mt-6">5. Privacy</h2>
        <p>We value your data. Refer to our <strong>Privacy Policy</strong> for details on how your data is collected and used.</p>

        <h2 className="text-xl font-semibold mt-6">6. User Data & Content</h2>
        <p>You retain ownership of your data. You grant us a limited license to process and store it solely to deliver the service.</p>

        <h2 className="text-xl font-semibold mt-6">7. Acceptable Use</h2>
        <p>You agree not to misuse the service, attempt unauthorized access, or automate feature manipulation (e.g., leaderboards).</p>

        <h2 className="text-xl font-semibold mt-6">8. Termination</h2>
        <p>We may suspend or terminate access if you violate these Terms or compromise platform integrity.</p>

        <h2 className="text-xl font-semibold mt-6">9. Disclaimer</h2>
        <p>The App is provided “as is” with no warranties. We do not guarantee accuracy of reports or financial outcomes.</p>

        <h2 className="text-xl font-semibold mt-6">10. Limitation of Liability</h2>
        <p>We are not liable for indirect or consequential damages from using the app.</p>

        <h2 className="text-xl font-semibold mt-6">11. Modifications</h2>
        <p>We may update these Terms. Continued use after changes implies acceptance.</p>

        <h2 className="text-xl font-semibold mt-6">12. Contact</h2>
        <p>📧 For queries or support, email us at <strong>appquery.team@gmail.com</strong></p>
      </div>
    </div>
  );
};

export default Terms;
