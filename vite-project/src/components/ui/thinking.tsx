import React from "react";

type ThinkingProps = {
	/** sm = 8px, md = 10px, lg = 14px */
	size?: "sm" | "md" | "lg";
	/** Accessible label text. Defaults to "Thinking" */
	label?: string;
	/** Optional extra class names for the wrapper */
	className?: string;
	/** Hide the label text and show only the animation */
	hideLabel?: boolean;
};

export function Thinking({
	size = "md",
	label = "Thinking",
	className = "",
	hideLabel = false,
}: ThinkingProps) {
	const dotSizePx = size === "sm" ? 8 : size === "lg" ? 14 : 10;
	// Allow CSS custom property without unsafe casts
	type CSSVarStyle = React.CSSProperties & { ["--dot-size"]?: string };
	const style: CSSVarStyle = { "--dot-size": `${dotSizePx}px` };

	return (
		<div
			className={`relative inline-flex items-center ${className}`}
			aria-live="polite"
			aria-busy="true"
			role="status"
		>
			{!hideLabel && (
				<span className="md:text-xl  mr-2 text-xl text-gray-500 max-w-2xl mx-auto font-semibold">
					{label}
				</span>
			)}
			<div className="thinking" style={style}>
				<span className="thinking-dot" />
				<span className="thinking-dot" />
				<span className="thinking-dot" />
			</div>
		</div>
	);
}

export default Thinking;
