'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print print-hide flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
    >
      🖨️ הדפסה
    </button>
  )
}
