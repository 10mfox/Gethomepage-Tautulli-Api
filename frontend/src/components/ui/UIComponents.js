/**
 * UI component library for application
 * Contains reusable UI elements with consistent styling
 * @module components/ui/UIComponents
 */
import React from "react";

/**
 * Alert component for displaying messages
 * Provides different variants for different message types
 * 
 * @param {Object} props - Component props
 * @param {string} [props.className=""] - Additional CSS classes
 * @param {string} [props.variant="default"] - Alert variant (default, destructive, success)
 * @param {React.Ref} ref - Forwarded ref
 * @returns {JSX.Element} Rendered component
 */
export const Alert = React.forwardRef(({ className = "", variant = "default", ...props }, ref) => {
  /**
   * Get CSS classes based on variant
   * 
   * @returns {string} CSS class string
   */
  const getColorClasses = () => {
    switch (variant) {
      case "destructive":
        return "border-red-900/20 text-red-200";
      case "success":
        return "text-gray-200";
      default:
        return "text-gray-200"; 
    }
  };

  return (
    <div
      ref={ref}
      role="alert"
      className={`rounded-lg border p-4 bg-black/20 ${getColorClasses()} ${className}`}
      style={{ 
        borderColor: variant === "destructive" ? "rgba(127, 29, 29, 0.2)" : "rgb(var(--primary) / 0.2)"
      }}
      {...props}
    />
  );
});

/**
 * Alert description component
 * 
 * @param {Object} props - Component props
 * @param {string} [props.className=""] - Additional CSS classes
 * @param {React.Ref} ref - Forwarded ref
 * @returns {JSX.Element} Rendered component
 */
export const AlertDescription = React.forwardRef(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`text-sm leading-relaxed ${className}`}
    {...props}
  />
));

Alert.displayName = "Alert";
AlertDescription.displayName = "AlertDescription";

/**
 * Button component with variants
 * 
 * @param {Object} props - Component props
 * @param {string} [props.variant="primary"] - Button variant
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Button content
 * @param {React.Ref} ref - Forwarded ref
 * @returns {JSX.Element} Rendered component
 */
export const Button = React.forwardRef(
  ({ variant = "primary", className = "", children, ...props }, ref) => {
    const getVariantClasses = () => {
      switch (variant) {
        case "secondary":
          return "bg-black/20 hover:bg-white/5 text-gray-300 hover:text-white";
        case "accent":
          return "bg-opacity-90 hover:bg-opacity-100 text-white bg-[rgb(var(--accent))]";
        case "danger":
          return "bg-red-600 hover:bg-red-700 text-white";
        case "primary":
        default:
          return "bg-opacity-90 hover:bg-opacity-100 text-white bg-[rgb(var(--primary))]";
      }
    };

    return (
      <button
        ref={ref}
        className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 ${getVariantClasses()} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";