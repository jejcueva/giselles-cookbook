export type NavIconName = "home" | "book" | "heart" | "chat" | "settings" | "search" | "tag";

export function OutlineIcon({
  name,
  className,
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "home" && (
        <>
          <path d="M3.75 10.5 12 3.75l8.25 6.75" />
          <path d="M5.25 9.75v9a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5v-9" />
          <path d="M10.5 20.25V15a1.5 1.5 0 0 1 3 0v5.25" />
        </>
      )}
      {name === "book" && (
        <>
          <path d="M12 5.25c-1.9-1.45-4.76-1.95-8.25-1.5v15c3.49-.45 6.35.05 8.25 1.5" />
          <path d="M12 5.25c1.9-1.45 4.76-1.95 8.25-1.5v15c-3.49-.45-6.35.05-8.25 1.5" />
        </>
      )}
      {name === "heart" && (
        <path d="M12 20.25s-6.75-4.35-8.25-8.1c-1.11-2.78.18-5.9 3-6.9 1.84-.66 3.68-.1 5.25 1.65 1.57-1.75 3.41-2.31 5.25-1.65 2.82 1 4.11 4.12 3 6.9-1.5 3.75-8.25 8.1-8.25 8.1Z" />
      )}
      {name === "chat" && (
        <path d="M7.5 18.75 3.75 20.25l1.5-4.5A7.5 7.5 0 1 1 20.25 12a7.5 7.5 0 0 1-7.5 7.5H7.5Z" />
      )}
      {name === "settings" && (
        <>
          <path d="M4.5 6.75h6.75" />
          <path d="M15 6.75h4.5" />
          <circle cx="13.125" cy="6.75" r="1.875" />
          <path d="M4.5 12h3" />
          <path d="M11.25 12h8.25" />
          <circle cx="8.625" cy="12" r="1.875" />
          <path d="M4.5 17.25h9" />
          <path d="M17.25 17.25h2.25" />
          <circle cx="15.375" cy="17.25" r="1.875" />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="10.5" cy="10.5" r="5.75" />
          <path d="m15.25 15.25 4 4" />
        </>
      )}
      {name === "tag" && (
        <>
          <path d="M20.25 11.25 12.75 3.75H3.75v9l7.5 7.5 9-9Z" />
          <circle cx="8.25" cy="8.25" r="1.5" />
        </>
      )}
    </svg>
  );
}
