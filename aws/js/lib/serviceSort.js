// js/lib/serviceSort.js
// Display ordering for the services reference page: services alphabetize by
// their bare name, ignoring the "AWS " / "Amazon " vendor prefix, so Amazon
// EC2 sorts under E and AWS Lambda under L.
export function bareName(name) {
  return name.replace(/^(?:AWS|Amazon)\s+/, '');
}

export function sortByBareName(services) {
  return [...services].sort((a, b) => bareName(a.name).localeCompare(bareName(b.name)));
}
