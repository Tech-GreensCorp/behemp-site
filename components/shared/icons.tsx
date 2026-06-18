import React from 'react';

interface IconProps extends React.ComponentPropsWithoutRef<'svg'> {
  size?: number;
}

export function Instagram({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function WhatsApp({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.37 5.054L2 22l5.12-1.335a9.952 9.952 0 0 0 4.887 1.281h.005c5.507 0 9.99-4.478 9.99-9.986 0-2.67-1.037-5.18-2.92-7.062A9.925 9.925 0 0 0 12.012 2Zm5.72 14.106c-.25.707-1.48 1.34-2.03 1.432-.495.083-1.13.153-3.262-.73-2.73-1.127-4.482-3.907-4.62-4.093-.137-.18-.99-1.32-.99-2.52 0-1.2.62-1.782.843-2.03.223-.246.493-.307.656-.307.165 0 .33.003.473.01.15.006.35-.054.55.43.204.496.696 1.706.757 1.83.06.124.1.27.017.433-.083.167-.123.27-.246.413-.123.14-.257.315-.367.422-.12.116-.243.243-.1.49.143.245.635 1.047 1.36 1.696.936.83 1.722 1.09 1.968 1.216.247.125.39.103.535-.062.146-.166.623-.726.79-1.01.166-.282.33-.23.553-.146.223.084 1.417.67 1.662.793.247.123.41.186.47.29.06.103.06.603-.19 1.31Z"/>
    </svg>
  );
}
