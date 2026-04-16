'use client';

import QRCode from 'react-qr-code';
import { useEffect, useState } from 'react';

export default function QRPage() {
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    // Use actual deployed URL in production, localhost in dev
    const url = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    setAppUrl(url);
  }, []);

  const menuUrl = `${appUrl}/menu`;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 print:p-4">

      {/* Print button - hidden when printing */}
      <button
        onClick={() => window.print()}
        className="mb-8 bg-orange-500 text-white font-bold px-6 py-2 rounded-xl print:hidden"
      >
        🖨️ Print this QR
      </button>

      {/* Card to print */}
      <div className="border-4 border-orange-500 rounded-3xl p-8 max-w-xs w-full text-center shadow-lg print:shadow-none print:border-black">

        <div className="mb-4">
          <p className="text-3xl font-black text-orange-600 tracking-tight">FoodCart</p>
          <p className="text-lg font-bold text-gray-600">ಫುಡ್ ಕಾರ್ಟ್</p>
          <p className="text-sm text-gray-500 mt-1">Fresh Rice Bath Daily</p>
        </div>

        {/* Big QR */}
        <div className="flex justify-center my-6 bg-white p-3 rounded-2xl border border-gray-100">
          {menuUrl ? (
            <QRCode value={menuUrl} size={200} />
          ) : (
            <div className="w-[200px] h-[200px] bg-gray-100 rounded-xl animate-pulse" />
          )}
        </div>

        <p className="text-base font-black text-gray-800 mb-1">
          📱 Scan to Order
        </p>
        <p className="text-base font-bold text-orange-500 mb-1">
          ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ಆರ್ಡರ್ ಮಾಡಿ
        </p>

        <div className="mt-4 bg-orange-50 rounded-2xl p-3 space-y-1.5">
          <Step n="1" en="Scan this QR" kn="QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ" />
          <Step n="2" en="Choose your food" kn="ತಿಂಡಿ ಆರಿಸಿ" />
          <Step n="3" en="Pay with GPay / PhonePe" kn="GPay / PhonePe ಇಂದ ಪಾವತಿಸಿ" />
          <Step n="4" en="Collect when token shows" kn="ಟೋಕನ್ ಬಂದಾಗ ತೆಗೆದುಕೊಳ್ಳಿ" />
        </div>

        <p className="text-xs text-gray-400 mt-4 break-all">{menuUrl}</p>
      </div>

      <p className="mt-6 text-xs text-gray-400 print:hidden">
        Print and laminate — place at the counter
      </p>
    </div>
  );
}

function Step({ n, en, kn }: { n: string; en: string; kn: string }) {
  return (
    <div className="flex items-center gap-2 text-left">
      <span className="bg-orange-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0">
        {n}
      </span>
      <div>
        <span className="text-xs font-semibold text-gray-700">{en}</span>
        <span className="text-xs text-orange-500 ml-1">· {kn}</span>
      </div>
    </div>
  );
}
