// Wordmark oficial de Klu (klumx.webflow.io). El texto usa currentColor
// para adaptarse a fondos claros/oscuros; el punto queda siempre naranja.

export function KluLogo({
  className = "",
  wordmarkClassName = "text-forest-900",
}: {
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <svg
      viewBox="0 0 66 30"
      role="img"
      aria-label="Klu"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className={wordmarkClassName} fill="currentColor">
        <path d="M50.7618 20.4666C50.7618 23.6156 48.4154 25.9189 45.4283 25.9189C42.6932 25.9189 40.0948 24.0295 40.0948 20.7438V7.98944H35.5063V21.226C35.5063 24.5549 37.3633 27.452 40.0948 28.9383C41.3328 29.6113 42.7148 29.9964 44.2623 29.9964C46.4612 29.9964 49.1603 28.8916 50.7618 27.1389V29.9964H55.3503V7.98944H50.7618V20.463V20.4666Z" />
        <path d="M27.0094 29.9964H31.5979V0H27.0094V29.9964Z" />
        <path d="M23.0686 26.2968L13.6288 12.6931C17.4508 9.0799 20.8265 4.81166 23.0686 0H17.8287C14.7805 5.33349 10.2387 10.1272 5.06358 13.4849V0H0V29.9964H5.06718V18.9335C6.71545 18.0122 8.30255 16.9866 9.81047 15.8673L19.3474 30H25.6346L23.065 26.3004L23.0686 26.2968Z" />
      </g>
      <path
        d="M62.3356 29.9568C64.202 29.9568 65.715 28.4438 65.715 26.5775C65.715 24.7112 64.202 23.1982 62.3356 23.1982C60.4693 23.1982 58.9563 24.7112 58.9563 26.5775C58.9563 28.4438 60.4693 29.9568 62.3356 29.9568Z"
        fill="#F99B1C"
      />
    </svg>
  );
}
