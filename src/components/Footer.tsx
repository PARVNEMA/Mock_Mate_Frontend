function Footer() {
  return (
    <footer className="w-full border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 mt-auto transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Branding Area */}
        <div className="flex items-center gap-3 group cursor-default">
          <div className="w-8 h-8 bg-linear-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-transform duration-300">
            <span className="text-white font-black text-sm">M</span>
          </div>
          <span className="text-base font-black tracking-tighter bg-linear-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-300 bg-clip-text text-transparent">
            MockMate
          </span>
        </div>

        {/* Copyright Text */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center md:text-left">
          © {new Date().getFullYear()} MockMate Platform.{" "}
          <span className="hidden sm:inline opacity-50">•</span>{" "}
          <span className="block sm:inline mt-1 sm:mt-0">
            AI-Powered Excellence.
          </span>
        </p>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          {[
            { label: "About", href: "/about" },
            { label: "Contact", href: "/contact" },
            { label: "Terms", href: "/terms" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
