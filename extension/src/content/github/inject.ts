export function inject(hostname: string): void {
  if (hostname.includes('github.com')) {
    console.log('Termipus: initializing GitHub integration');
  }
}
