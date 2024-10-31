'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js'
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { CognitoIdentityProviderClient, ConfirmSignUpCommand, InitiateAuthCommand, SignUpCommand } from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({ region: "us-east-1" });
const USER_POOL_ID = process.env.NEXT_PUBLIC_USER_POOL_ID as string;
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID as string;

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: "access",
  clientId: CLIENT_ID,
});

function App() {
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [isConfirmingSignUp, setIsConfirmingSignUp] = useState(false);

  const fetchSampleData = async (accessToken: any) => {
    try {      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
          accessToken: async () => {
            const token = await verifyToken(accessToken)

            console.log(token);
            
            // Alternatively you can use tokens?.idToken instead.
            if (!token) {
              return "";
            }
            
            return token
          },
      })

      const { data, error } = await supabase
        .from('sample')
        .select('*')
      
      console.log(data);
      if (error) throw error;
      
      setSampleData(data || []);
    } catch (error) {
      console.error('データ取得エラー:', error);
      alert('データの取得に失敗しました。');
    }
  };


  const verifyToken = async (token: string) => {
    try {      
      const payload = await verifier.verify(token);
      setSession(payload);
      
      return token;
    } catch {
      setSession(null);
      localStorage.removeItem("accessToken");
    }
  };

  const signUp = async () => {
    try {
      const command = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
      });
      await cognitoClient.send(command);
      alert("サインアップ成功！確認コードをメールで確認してください。");
      setIsConfirmingSignUp(true);
    } catch (error) {
      console.error("サインアップエラー:", error);
      alert("サインアップに失敗しました。");
    }
  };

  const confirmSignUp = async () => {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: confirmationCode,
      });
      await cognitoClient.send(command);
      alert("確認が完了しました。サインインしてください。");
      setIsConfirmingSignUp(false);
    } catch (error) {
      console.error("確認エラー:", error);
      alert("確認に失敗しました。");
    }
  };

  const signIn = async () => {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });
      const response = await cognitoClient.send(command);
      const accessToken = response.AuthenticationResult?.AccessToken;
      if (accessToken) {
        localStorage.setItem("accessToken", accessToken);
        await fetchSampleData(accessToken);
      } else {
        throw new Error("Access tokenが未定義です");
      }
    } catch (error) {
      console.error("サインインエラー:", error);
      alert("サインインに失敗しました。");
    }
  };

  const signOut = () => {
    localStorage.removeItem("accessToken");
    setSession(null);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          await fetchSampleData(token);
        } catch (error) {
          console.error("認証初期化エラー:", error);
          signOut();
        }
      }
    };
  
    initializeAuth();
  }, []);

  if (!session) {
    if (isConfirmingSignUp) {
      return (
        <main className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md w-96">
            <h1 className="text-2xl font-bold mb-4 text-center">確認コードを入力してください</h1>
            <input
              type="text"
              placeholder="確認コード"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              className="w-full p-2 mb-4 border rounded"
            />
            <button 
              onClick={confirmSignUp}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition duration-200"
            >
              確認
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-4 text-center">ログインまたはサインアップ</h1>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
          />
          <div className="flex space-x-4">
            <button 
              onClick={signIn}
              className="flex-1 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition duration-200"
            >
              サインイン
            </button>
            <button 
              onClick={signUp}
              className="flex-1 bg-green-500 text-white p-2 rounded hover:bg-green-600 transition duration-200"
            >
              サインアップ
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">ユーザー情報</h2>
          <p className="mb-2">ユーザーID: <span className="font-semibold">{session.sub}</span></p>
          <p>トークン有効期限: <span className="font-semibold">{new Date(session.exp * 1000).toLocaleString()}</span></p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">サンプルデータ</h2>
          <ul className="pl-5 list-none">
            {sampleData.map((item, index) => (
              <li key={index} className="mb-2 p-3 bg-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow duration-200">
                <span className="font-semibold text-gray-700">ID: </span><span className="text-blue-600">{item.id}</span>
                <br />
                <span className="font-semibold text-gray-700">テキスト: </span><span className="text-green-600">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <button 
          onClick={signOut}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition duration-200"
        >
          サインアウト
        </button>
      </div>
    </main>
  );
}

export default App;