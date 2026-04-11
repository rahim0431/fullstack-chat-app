const AuthImagePattern = ({ title, subtitle }) => {
  return (
    <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-12 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-8 gap-2 transform rotate-12 scale-150">
          {[...Array(64)].map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-full ${
                (i % 7 === 0) ? "bg-primary animate-pulse" :
                (i % 5 === 0) ? "bg-secondary" :
                (i % 3 === 0) ? "bg-accent" :
                "bg-base-content/20"
              }`}
              style={{
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${2 + (i % 3)}s`
              }}
            />
          ))}
        </div>
      </div>

      <div className="max-w-md text-center relative z-10">
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 shadow-lg transform transition-transform hover:scale-110 ${
                i % 2 === 0 ? "animate-bounce" : "animate-pulse"
              }`}
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: `${2 + (i % 2)}s`
              }}
            />
          ))}
        </div>
        <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-base-content/70 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
};

export default AuthImagePattern;
