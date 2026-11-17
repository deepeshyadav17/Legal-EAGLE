import { useCallback, useState } from 'react';
import { validate } from '../utils/validators';
import { sanitizeFormPayload, sanitizeString } from '../utils/security';

/** Controlled-form state with automatic input sanitization and schema validation. */
export function useForm(initialValues, schema = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const setField = useCallback(
    (name, value) => {
      setValues((prev) => {
        const next = { ...prev, [name]: value };
        if (touched[name] || errors[name]) {
          const fieldErrors = validate({ [name]: schema[name] || [] }, next);
          setErrors((e) => ({ ...e, [name]: fieldErrors[name] }));
        }
        return next;
      });
    },
    [schema, touched, errors],
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setField(name, type === 'checkbox' ? checked : value);
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    setValues((prev) => {
      const currentVal = prev[name];
      const cleanedVal =
        typeof currentVal === 'string' && name !== 'password' && name !== 'confirmPassword'
          ? sanitizeString(currentVal)
          : currentVal;
      const next = { ...prev, [name]: cleanedVal };
      const fieldErrors = validate({ [name]: schema[name] || [] }, next);
      setErrors((errPrev) => ({ ...errPrev, [name]: fieldErrors[name] }));
      return next;
    });
  };

  /** Validates all fields and sanitizes values; returns true when valid. */
  const validateAll = () => {
    const all = validate(schema, values);
    setErrors(all);
    setTouched(Object.fromEntries(Object.keys(schema).map((k) => [k, true])));
    if (Object.keys(all).length === 0) {
      setValues((prev) => sanitizeFormPayload(prev));
      return true;
    }
    return false;
  };

  const reset = (next = initialValues) => {
    setValues(next);
    setErrors({});
    setTouched({});
  };

  const field = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: handleChange,
    onBlur: handleBlur,
    error: errors[name],
  });

  return { values, setValues, errors, setErrors, setField, handleChange, handleBlur, validateAll, reset, field };
}
