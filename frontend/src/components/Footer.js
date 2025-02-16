import React from 'react';
import { Github } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 p-2 bg-gray-800 border-t border-gray-700 text-center z-50">
      <div className="container mx-auto flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Created by{' '}
          <a
            href="https://github.com/10mfox"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-blue-400 transition-colors duration-200"
          >
            10mfox
          </a>
        </p>
        <a
          href="https://github.com/10mfox/Gethomepage-Tautulli-Api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-white transition-colors duration-200"
        >
          <Github className="h-5 w-5" />
        </a>
      </div>
    </footer>
  );
};

export default Footer;