function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function pickAllowedFields(body, allowedFields) {
  const source = body && typeof body === 'object' ? body : {};
  return allowedFields.reduce((result, field) => {
    if (hasOwn(source, field)) result[field] = source[field];
    return result;
  }, {});
}

function referencesAnotherCandidate(req, candidateId) {
  if (!hasOwn(req.body, 'candidate_id')) return false;
  return req.body.candidate_id !== candidateId;
}

function cleanRequiredText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = {
  cleanRequiredText,
  hasOwn,
  pickAllowedFields,
  referencesAnotherCandidate,
};
