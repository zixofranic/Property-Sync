import Link from "next/link";
import { ArrowRight, Home, Users, Share2, BarChart3, CheckCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Home className="h-8 w-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">Property Sync</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/login"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 text-shadow">
              Share Property Timelines
              <span className="block text-blue-400">With Your Clients</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Streamline your real estate workflow. Create beautiful property timelines, 
              share them securely with clients, and track engagement in real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="border border-gray-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/10 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-6 py-20 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Powerful tools designed specifically for real estate professionals
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass p-8 rounded-xl">
              <Users className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Client Management</h3>
              <p className="text-gray-300">
                Organize all your clients in one place. Add contact details, preferences, 
                and track their property journey.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass p-8 rounded-xl">
              <Home className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Property Timelines</h3>
              <p className="text-gray-300">
                Create beautiful, organized timelines for each property. Add photos, 
                descriptions, and MLS links.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass p-8 rounded-xl">
              <Share2 className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Secure Sharing</h3>
              <p className="text-gray-300">
                Share timelines with clients using secure, personalized links. 
                No accounts required for clients.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass p-8 rounded-xl">
              <BarChart3 className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Real-time Analytics</h3>
              <p className="text-gray-300">
                Track client engagement, view analytics, and understand which 
                properties generate the most interest.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="glass p-8 rounded-xl">
              <CheckCircle className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Client Feedback</h3>
              <p className="text-gray-300">
                Collect instant feedback from clients with Love, Like, or Dislike 
                reactions and detailed notes.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="glass p-8 rounded-xl">
              <ArrowRight className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Email Automation</h3>
              <p className="text-gray-300">
                Automatically send beautiful emails when sharing timelines and 
                receive notifications when clients provide feedback.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Real Estate Business?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of agents who are already using Property Sync to 
            streamline their workflows and delight their clients.
          </p>
          <Link
            href="/register"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 inline-flex items-center gap-2"
          >
            Start Your Free Trial
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-6 py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Home className="h-6 w-6 text-blue-400" />
            <span className="text-xl font-bold text-white">Property Sync</span>
          </div>
          <p className="text-gray-400">
            © 2024 Property Sync. Built for real estate professionals.
          </p>
        </div>
      </footer>
    </div>
  );
}
