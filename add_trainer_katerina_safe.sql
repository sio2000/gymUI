-- Safe script to add trainer Katerina (handles existing user and profile)
-- Email: katerina@freegym.gr
-- Password: trainer123

DO $$
DECLARE
    user_exists boolean;
    profile_exists boolean;
    user_id_val uuid;
BEGIN
    -- Check if user exists in auth.users
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'katerina@freegym.gr') INTO user_exists;
    
    IF user_exists THEN
        -- Get the existing user ID
        SELECT id INTO user_id_val FROM auth.users WHERE email = 'katerina@freegym.gr';
        
        -- Check if profile exists
        SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id = user_id_val) INTO profile_exists;
        
        IF profile_exists THEN
            -- Update existing profile to trainer role
            UPDATE public.user_profiles 
            SET 
                first_name = 'Katerina',
                last_name = 'Trainer',
                role = 'trainer',
                updated_at = NOW()
            WHERE user_id = user_id_val;
            
            RAISE NOTICE 'User katerina@freegym.gr already exists with profile. Updated to trainer role.';
        ELSE
            -- Create new profile for existing user
            INSERT INTO public.user_profiles (
                user_id,
                first_name,
                last_name,
                email,
                role,
                created_at,
                updated_at
            ) VALUES (
                user_id_val,
                'Katerina',
                'Trainer',
                'katerina@freegym.gr',
                'trainer',
                NOW(),
                NOW()
            );
            
            RAISE NOTICE 'User katerina@freegym.gr exists but no profile. Created profile with trainer role.';
        END IF;
        
    ELSE
        -- Create new user
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'katerina@freegym.gr',
            crypt('trainer123', gen_salt('bf')),
            NOW(),
            NULL,
            NULL,
            '{"provider": "email", "providers": ["email"]}',
            '{"first_name": "Katerina", "last_name": "Trainer", "role": "trainer"}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
        
        -- Get the new user ID
        SELECT id INTO user_id_val FROM auth.users WHERE email = 'katerina@freegym.gr';
        
        -- Create user profile
        INSERT INTO public.user_profiles (
            user_id,
            first_name,
            last_name,
            email,
            role,
            created_at,
            updated_at
        ) VALUES (
            user_id_val,
            'Katerina',
            'Trainer',
            'katerina@freegym.gr',
            'trainer',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'New user katerina@freegym.gr created with trainer role.';
    END IF;
END $$;

-- Verify the result
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    up.first_name,
    up.last_name,
    up.role,
    up.created_at,
    up.updated_at
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.user_id
WHERE u.email = 'katerina@freegym.gr';
