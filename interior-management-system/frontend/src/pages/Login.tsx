import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { LogIn } from 'lucide-react';

interface LoginForm {
  username: string;
  password: string;
}

const Login = () => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await login(data.username, data.password);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (username: string) => {
    setValue('username', username);
    setValue('password', '0109');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">HV LAB</h2>
            <p className="mt-2 text-sm text-gray-600">
              통합 업무 관리 시스템
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                아이디
              </label>
              <input
                {...register('username', {
                  required: '아이디를 입력하세요',
                })}
                type="text"
                className="input"
                placeholder="아이디를 입력하세요"
                autoFocus
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <input
                {...register('password', {
                  required: '비밀번호를 입력하세요',
                })}
                type="password"
                className="input"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  로그인
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t pt-6">
            <p className="text-sm text-gray-600 text-center mb-4">빠른 로그인</p>
            <div className="grid grid-cols-3 gap-2">
              {['상준', '신애', '재천', '민기', '재성', '재현'].map((name) => (
                <button
                  key={name}
                  onClick={() => handleQuickLogin(name)}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  type="button"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;