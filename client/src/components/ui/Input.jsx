const Input = ({ label, name, type = 'text', error, className = '', ...rest }) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        className={`
          w-full px-3 py-2 border rounded-lg text-sm
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-500
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}
          ${className}
        `}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Input;
