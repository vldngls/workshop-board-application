interface MaintenanceNoticeProps {
  message?: string;
}

export default function MaintenanceNotice({
  message,
}: MaintenanceNoticeProps) {
  return (
    <main
      className="min-h-dvh flex items-center justify-center p-6"
      style={{ background: "var(--ios-bg-secondary)" }}
    >
      <div className="flex flex-col items-center max-w-md mx-auto">
        <div className="relative mb-12">
          <div className="w-24 h-24 bg-white rounded-3xl shadow-lg flex items-center justify-center border border-gray-200">
            <svg
              className="animate-float"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
                fill="#003478"
              />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-8">
          <div className="space-y-3">
            <h1
              className="text-4xl font-bold text-black animate-fade-in"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}
            >
              Job Control Board
            </h1>
            <p
              className="text-lg font-medium animate-fade-in"
              style={{
                animationDelay: "0.2s",
                color: "var(--ios-text-secondary)",
              }}
            >
              System Maintenance
            </p>
          </div>

          <div
            className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Under Maintenance
            </h2>

            <p className="text-gray-600 mb-6">
              {message ??
                "We are currently performing scheduled maintenance. Please check back later."}
            </p>

            <p className="text-sm text-gray-500">
              We apologize for any inconvenience. Thank you for your patience.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}


