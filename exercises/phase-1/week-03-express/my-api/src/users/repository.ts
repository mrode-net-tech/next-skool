export interface User {
  id: string;
  name: string | null;
  email: string;
  password: string;
}

export interface UserRepository {
  reset(): Promise<void>;

  findById(id: string): Promise<User>;

  findByEmail(email: string): Promise<User | null>;

  add(name: string, email: string, password: string): Promise<User>;
}
