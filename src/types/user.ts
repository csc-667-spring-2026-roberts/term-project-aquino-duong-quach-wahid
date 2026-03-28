// insert user
export interface User {
  id: number;
  email: string;
}

export interface DbUser extends User {
  password_hash: string;
  created_at: Date;
}
