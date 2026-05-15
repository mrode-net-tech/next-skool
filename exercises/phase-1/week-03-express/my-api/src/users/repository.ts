export interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface UserRepository {
  reset(): Promise<void>;
  add(name: string, email: string): Promise<User>;
}
