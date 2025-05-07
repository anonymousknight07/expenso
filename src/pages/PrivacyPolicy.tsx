import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <div className="space-y-4 text-base leading-relaxed">
        <p><strong>Effective Date:</strong> xxxxxx</p>

        <p>
          At <strong>Expenso</strong>, your privacy is important to us. This Privacy Policy outlines the types of information we collect, how we use and protect it, and the choices you have in relation to your personal data.
        </p>

        <h2 className="text-xl font-semibold mt-6">1. Information We Collect</h2>
        <ul className="list-disc list-inside">
          <li><strong>Personal Info:</strong> Name, email address, phone number (optional), Google account info (if signed in via Google).</li>
          <li><strong>Financial Data:</strong> Income, expenses, budgets, and other manually entered financial information.</li>
          <li><strong>Usage Data:</strong> Device info, IP address, interaction logs (e.g., button clicks, feature usage).</li>
          <li><strong>Analytics Data:</strong> Data collected through third-party services like Firebase or Supabase for performance and crash reporting.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">2. How We Use Your Information</h2>
        <ul className="list-disc list-inside">
          <li>To provide and personalize the Expenso service.</li>
          <li>To analyze spending patterns and generate financial insights.</li>
          <li>To store and sync data across devices securely.</li>
          <li>To communicate updates, tips, and promotional content (you can opt out).</li>
          <li>To detect, prevent, and respond to fraud or abuse.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">3. Data Sharing</h2>
        <p>We do <strong>not sell</strong> your personal information. We only share data with:</p>
        <ul className="list-disc list-inside">
          <li>Trusted service providers (e.g., Firebase, Supabase, MongoDB Atlas) for hosting and analytics.</li>
          <li>Law enforcement or regulators, if required by law.</li>
          <li>Third-party integrations you explicitly enable (e.g., export to Google Sheets).</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">4. Data Security</h2>
        <p>
          We use strong encryption (SSL/TLS), access controls, and secure cloud infrastructure to protect your data. However, no method of transmission over the internet is 100% secure.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Your Rights & Choices</h2>
        <ul className="list-disc list-inside">
          <li><strong>Access or Delete:</strong> You can view or delete your data anytime via account settings.</li>
          <li><strong>Export:</strong> Request an export of your financial data in JSON or CSV format.</li>
          <li><strong>Withdraw Consent:</strong> Disable certain features like AI nudges or notifications.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">6. Cookies & Tracking</h2>
        <p>
          We use cookies and local storage for authentication and feature preferences. Analytics tools may use cookies for performance monitoring.
        </p>

        <h2 className="text-xl font-semibold mt-6">7. Children's Privacy</h2>
        <p>
          Expenso is not intended for children under 13. We do not knowingly collect data from minors.
        </p>

        <h2 className="text-xl font-semibold mt-6">8. Data Retention</h2>
        <p>
          Your data is stored as long as your account remains active. Deleted accounts are permanently purged within 30 days.
        </p>

        <h2 className="text-xl font-semibold mt-6">9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy. If we make material changes, you’ll be notified via email or in-app alert.
        </p>

        <h2 className="text-xl font-semibold mt-6">10. Contact Us</h2>
        <p>
          📧 For questions or privacy concerns, reach out to us at <strong>appquery.team@gmail.com</strong>
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
